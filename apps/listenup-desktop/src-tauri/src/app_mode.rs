// @purpose 持久化并事务式切换自由 Desktop 与菜单栏 App 两种 macOS 形态。
// @role    Tauri setup、前端命令和 tray 菜单共享的 appMode 唯一权威。
// @deps    tauri activation/window APIs、serde、app-data JSON
// @gotcha  只有 runtime 属性和原子写入都成功才能更新内存；失败必须回滚旧形态。
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize};

pub(crate) const APP_MODE_CHANGED_EVENT: &str = "desktop-app-mode-changed";
pub(crate) const APP_MODE_ERROR_EVENT: &str = "desktop-app-mode-error";
const PREFERENCE_VERSION: u8 = 1;

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum AppMode {
    #[default]
    Desktop,
    Menubar,
}

#[derive(Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct AppModePreference {
    version: u8,
    app_mode: AppMode,
}

pub(crate) struct AppModeState {
    path: PathBuf,
    current: Mutex<AppMode>,
    desktop_geometry: Mutex<Option<WindowGeometry>>,
}

#[derive(Clone, Copy)]
struct WindowGeometry {
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
}

impl AppModeState {
    pub(crate) fn new(path: PathBuf, current: AppMode) -> Self {
        Self {
            path,
            current: Mutex::new(current),
            desktop_geometry: Mutex::new(None),
        }
    }

    pub(crate) fn current(&self) -> AppMode {
        self.current.lock().map(|mode| *mode).unwrap_or_default()
    }
}

pub(crate) struct AppModeMenuItem(pub(crate) tauri::menu::MenuItem<tauri::Wry>);

pub(crate) fn preference_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("desktop-preferences.json")
}

pub(crate) fn load(path: &Path) -> AppMode {
    match fs::read(path) {
        Ok(bytes) => match serde_json::from_slice::<AppModePreference>(&bytes) {
            Ok(preference) if preference.version == PREFERENCE_VERSION => preference.app_mode,
            Ok(_) => {
                eprintln!("[listenup] ignored unsupported desktop preference version");
                AppMode::Desktop
            }
            Err(error) => {
                eprintln!("[listenup] ignored invalid desktop preferences: {error}");
                AppMode::Desktop
            }
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => AppMode::Desktop,
        Err(error) => {
            eprintln!("[listenup] failed to read desktop preferences: {error}");
            AppMode::Desktop
        }
    }
}

fn persist(path: &Path, mode: AppMode) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Desktop 偏好路径无效".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("创建偏好目录失败：{error}"))?;
    let preference = AppModePreference {
        version: PREFERENCE_VERSION,
        app_mode: mode,
    };
    let mut bytes = serde_json::to_vec_pretty(&preference)
        .map_err(|error| format!("序列化 Desktop 偏好失败：{error}"))?;
    bytes.push(b'\n');
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, bytes).map_err(|error| format!("写入 Desktop 偏好失败：{error}"))?;
    fs::rename(&temporary, path).map_err(|error| format!("保存 Desktop 偏好失败：{error}"))
}

pub(crate) fn configure_initial(app: &mut tauri::App, mode: AppMode) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    app.set_activation_policy(match mode {
        AppMode::Desktop => tauri::ActivationPolicy::Regular,
        AppMode::Menubar => tauri::ActivationPolicy::Accessory,
    });
    configure_window(app.handle(), mode)
}

fn configure_runtime(app: &AppHandle, mode: AppMode) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    app.set_activation_policy(match mode {
        AppMode::Desktop => tauri::ActivationPolicy::Regular,
        AppMode::Menubar => tauri::ActivationPolicy::Accessory,
    })
    .map_err(|error| format!("切换 macOS 应用形态失败：{error}"))?;
    configure_window(app, mode)
}

fn configure_window(app: &AppHandle, mode: AppMode) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "字幕窗口不存在".to_string())?;
    window
        .set_resizable(mode == AppMode::Desktop)
        .map_err(|error| format!("切换窗口缩放能力失败：{error}"))?;
    window
        .set_skip_taskbar(mode == AppMode::Menubar)
        .map_err(|error| format!("切换任务栏形态失败：{error}"))?;
    if mode == AppMode::Menubar {
        window
            .hide()
            .map_err(|error| format!("隐藏自由窗口失败：{error}"))?;
    }
    Ok(())
}

fn update_menu_label(app: &AppHandle, mode: AppMode) {
    if let Some(item) = app.try_state::<AppModeMenuItem>() {
        let text = match mode {
            AppMode::Desktop => "切换到菜单栏 App",
            AppMode::Menubar => "切换到自由窗口",
        };
        let _ = item.0.set_text(text);
    }
}

fn capture_window_geometry(app: &AppHandle) -> Result<WindowGeometry, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "字幕窗口不存在".to_string())?;
    Ok(WindowGeometry {
        position: window
            .outer_position()
            .map_err(|error| format!("读取自由窗口位置失败：{error}"))?,
        size: window
            .outer_size()
            .map_err(|error| format!("读取自由窗口尺寸失败：{error}"))?,
    })
}

fn restore_window_geometry(app: &AppHandle, geometry: WindowGeometry) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "字幕窗口不存在".to_string())?;
    window
        .set_size(geometry.size)
        .map_err(|error| format!("恢复自由窗口尺寸失败：{error}"))?;
    window
        .set_position(geometry.position)
        .map_err(|error| format!("恢复自由窗口位置失败：{error}"))
}

fn rollback_runtime(
    app: &AppHandle,
    previous: AppMode,
    previous_geometry: Option<WindowGeometry>,
) -> Result<(), String> {
    configure_runtime(app, previous)?;
    if previous == AppMode::Desktop {
        if let Some(geometry) = previous_geometry {
            restore_window_geometry(app, geometry)?;
        }
    }
    Ok(())
}

pub(crate) fn switch(app: &AppHandle, next: AppMode) -> Result<AppMode, String> {
    let state = app.state::<AppModeState>();
    let previous = state.current();
    if previous == next {
        return Ok(next);
    }

    let captured_geometry = if previous == AppMode::Desktop {
        Some(capture_window_geometry(app)?)
    } else {
        None
    };
    let stored_geometry = state
        .desktop_geometry
        .lock()
        .map_err(|_| "自由窗口几何状态暂时不可用".to_string())?
        .to_owned();

    if let Err(error) = configure_runtime(app, next) {
        return match rollback_runtime(app, previous, captured_geometry) {
            Ok(()) => Err(error),
            Err(rollback_error) => Err(format!("{error}；回滚应用形态也失败：{rollback_error}")),
        };
    }
    if next == AppMode::Desktop {
        if let Some(geometry) = stored_geometry {
            if let Err(error) = restore_window_geometry(app, geometry) {
                return match rollback_runtime(app, previous, captured_geometry) {
                    Ok(()) => Err(error),
                    Err(rollback_error) => {
                        Err(format!("{error}；回滚应用形态也失败：{rollback_error}"))
                    }
                };
            }
        }
    }
    if let Err(error) = persist(&state.path, next) {
        if let Err(rollback_error) = rollback_runtime(app, previous, captured_geometry) {
            return Err(format!(
                "{error}；回滚应用形态也失败：{rollback_error}。重启后将恢复原偏好"
            ));
        }
        return Err(error);
    }
    if next == AppMode::Menubar {
        *state
            .desktop_geometry
            .lock()
            .map_err(|_| "自由窗口几何状态暂时不可用".to_string())? = captured_geometry;
    }
    *state
        .current
        .lock()
        .map_err(|_| "Desktop 形态状态暂时不可用".to_string())? = next;
    update_menu_label(app, next);
    let _ = app.emit(APP_MODE_CHANGED_EVENT, next);

    if next == AppMode::Desktop {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
    Ok(next)
}

pub(crate) fn toggle(app: &AppHandle) -> Result<AppMode, String> {
    let next = match app.state::<AppModeState>().current() {
        AppMode::Desktop => AppMode::Menubar,
        AppMode::Menubar => AppMode::Desktop,
    };
    switch(app, next)
}

#[tauri::command]
pub(crate) fn get_app_mode(state: tauri::State<'_, AppModeState>) -> AppMode {
    state.current()
}

#[tauri::command]
pub(crate) fn set_app_mode(app: AppHandle, mode: AppMode) -> Result<AppMode, String> {
    switch(&app, mode)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "listenup-app-mode-{}-{name}.json",
            std::process::id()
        ))
    }

    #[test]
    fn missing_or_invalid_preferences_default_to_desktop() {
        let path = test_path("defaults");
        let _ = fs::remove_file(&path);
        assert_eq!(load(&path), AppMode::Desktop);
        fs::write(&path, b"not-json").unwrap();
        assert_eq!(load(&path), AppMode::Desktop);
        fs::write(&path, br#"{"version":99,"appMode":"menubar"}"#).unwrap();
        assert_eq!(load(&path), AppMode::Desktop);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn app_mode_roundtrips_through_atomic_preference_file() {
        let path = test_path("roundtrip");
        let _ = fs::remove_file(&path);
        persist(&path, AppMode::Menubar).unwrap();
        assert_eq!(load(&path), AppMode::Menubar);
        assert!(!path.with_extension("json.tmp").exists());
        let _ = fs::remove_file(path);
    }
}
