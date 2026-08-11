// @purpose 解析用户手动粘贴的完整 Cookie 串，并在 macOS Keychain 中安全保存供字幕 transport 使用。
// @role    Desktop iframe 字幕请求的唯一 Cookie 信任边界；提供状态、原子替换、只读请求头和清除 commands。
// @deps    security-framework(macOS)、Tauri main command
// @gotcha  原值、键名和数量不得进入 Debug/Display、错误、日志、snapshot、SQLite 或 Extension 通道。

use std::{collections::BTreeMap, fmt, sync::Arc};

use serde::Serialize;
use tauri::{State, Webview};

const MAX_COOKIE_INPUT_BYTES: usize = 64 * 1024;
const MAX_COOKIE_KEYS: usize = 180;
const KEYCHAIN_ACCOUNT: &str = "youtube.com.manual-cookie-v1";
const ERR_SEC_ITEM_NOT_FOUND: i32 = -25_300;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ParseError {
    Empty,
    InputTooLarge,
    TooManyKeys,
    MissingSeparator,
    InvalidKey,
    UnsupportedAttribute,
    ControlCharacter,
}

impl fmt::Display for ParseError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let category = match self {
            Self::Empty => "empty",
            Self::InputTooLarge => "input-too-large",
            Self::TooManyKeys => "too-many-keys",
            Self::MissingSeparator => "missing-separator",
            Self::InvalidKey => "invalid-key",
            Self::UnsupportedAttribute => "unsupported-attribute",
            Self::ControlCharacter => "control-character",
        };
        write!(formatter, "cookie-parse:{category}")
    }
}

#[derive(Clone, Eq, PartialEq)]
pub(crate) struct CookiePair {
    name: String,
    value: String,
}

impl fmt::Debug for CookiePair {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("CookiePair([REDACTED])")
    }
}

fn is_cookie_token(value: &str) -> bool {
    !value.is_empty()
        && value.bytes().all(|byte| {
            byte.is_ascii_alphanumeric()
                || matches!(
                    byte,
                    b'!' | b'#'
                        | b'$'
                        | b'%'
                        | b'&'
                        | b'\''
                        | b'*'
                        | b'+'
                        | b'-'
                        | b'.'
                        | b'^'
                        | b'_'
                        | b'`'
                        | b'|'
                        | b'~'
                )
        })
}

fn is_cookie_attribute(name: &str) -> bool {
    [
        "domain",
        "path",
        "expires",
        "max-age",
        "samesite",
        "secure",
        "httponly",
        "partitioned",
    ]
    .iter()
    .any(|attribute| name.eq_ignore_ascii_case(attribute))
}

fn parse_cookie_header(raw: &str) -> Result<Vec<CookiePair>, ParseError> {
    if raw.as_bytes().len() > MAX_COOKIE_INPUT_BYTES {
        return Err(ParseError::InputTooLarge);
    }
    if raw.chars().any(char::is_control) {
        return Err(ParseError::ControlCharacter);
    }

    let mut pairs = BTreeMap::<String, String>::new();
    let mut parsed_segments = 0usize;
    for segment in raw
        .split(';')
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        parsed_segments += 1;
        if parsed_segments > MAX_COOKIE_KEYS {
            return Err(ParseError::TooManyKeys);
        }
        let (name, value) = segment
            .split_once('=')
            .ok_or(ParseError::MissingSeparator)?;
        let name = name.trim();
        if !is_cookie_token(name) {
            return Err(ParseError::InvalidKey);
        }
        if is_cookie_attribute(name) {
            return Err(ParseError::UnsupportedAttribute);
        }
        pairs.insert(name.to_string(), value.to_string());
    }
    if pairs.is_empty() {
        return Err(ParseError::Empty);
    }
    Ok(pairs
        .into_iter()
        .map(|(name, value)| CookiePair { name, value })
        .collect())
}

fn serialize_pairs(pairs: &[CookiePair]) -> Vec<u8> {
    pairs
        .iter()
        .map(|pair| format!("{}={}", pair.name, pair.value))
        .collect::<Vec<_>>()
        .join("; ")
        .into_bytes()
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum SecretStoreError {
    Read,
    Write,
    Delete,
}

trait SecretStore: Send + Sync {
    fn load(&self) -> Result<Option<Vec<u8>>, SecretStoreError>;
    fn replace(&self, secret: &[u8]) -> Result<(), SecretStoreError>;
    fn clear(&self) -> Result<(), SecretStoreError>;
}

#[cfg(target_os = "macos")]
struct KeychainSecretStore {
    service: String,
    account: &'static str,
}

fn keychain_service(bundle_id: &str) -> String {
    format!("{bundle_id}.youtube-cookie-vault")
}

#[cfg(target_os = "macos")]
impl Default for KeychainSecretStore {
    fn default() -> Self {
        Self {
            service: keychain_service(env!("LISTENUP_BUNDLE_ID")),
            account: KEYCHAIN_ACCOUNT,
        }
    }
}

#[cfg(target_os = "macos")]
impl SecretStore for KeychainSecretStore {
    fn load(&self) -> Result<Option<Vec<u8>>, SecretStoreError> {
        match security_framework::passwords::get_generic_password(&self.service, self.account) {
            Ok(secret) => Ok(Some(secret)),
            Err(error) if error.code() == ERR_SEC_ITEM_NOT_FOUND => Ok(None),
            Err(_) => Err(SecretStoreError::Read),
        }
    }

    fn replace(&self, secret: &[u8]) -> Result<(), SecretStoreError> {
        security_framework::passwords::set_generic_password(&self.service, self.account, secret)
            .map_err(|_| SecretStoreError::Write)
    }

    fn clear(&self) -> Result<(), SecretStoreError> {
        match security_framework::passwords::delete_generic_password(&self.service, self.account) {
            Ok(()) => Ok(()),
            Err(error) if error.code() == ERR_SEC_ITEM_NOT_FOUND => Ok(()),
            Err(_) => Err(SecretStoreError::Delete),
        }
    }
}

#[cfg(not(target_os = "macos"))]
#[derive(Default)]
struct KeychainSecretStore;

#[cfg(not(target_os = "macos"))]
impl SecretStore for KeychainSecretStore {
    fn load(&self) -> Result<Option<Vec<u8>>, SecretStoreError> {
        Err(SecretStoreError::Read)
    }

    fn replace(&self, _secret: &[u8]) -> Result<(), SecretStoreError> {
        Err(SecretStoreError::Write)
    }

    fn clear(&self) -> Result<(), SecretStoreError> {
        Err(SecretStoreError::Delete)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CookieVaultStatus {
    Missing,
    Saved,
    Failed,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum VaultError {
    Parse(ParseError),
    StoredSecretInvalid,
    Store(SecretStoreError),
}

impl fmt::Display for VaultError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Parse(error) => write!(formatter, "{error}"),
            Self::StoredSecretInvalid => formatter.write_str("cookie-store:invalid-secret"),
            Self::Store(SecretStoreError::Read) => formatter.write_str("cookie-store:read"),
            Self::Store(SecretStoreError::Write) => formatter.write_str("cookie-store:write"),
            Self::Store(SecretStoreError::Delete) => formatter.write_str("cookie-store:delete"),
        }
    }
}

pub(crate) struct CookieVault {
    store: Arc<dyn SecretStore>,
}

impl CookieVault {
    fn new(store: Arc<dyn SecretStore>) -> Self {
        Self { store }
    }

    fn status(&self) -> CookieVaultStatus {
        match self.store.load() {
            Ok(Some(_)) => CookieVaultStatus::Saved,
            Ok(None) => CookieVaultStatus::Missing,
            Err(_) => CookieVaultStatus::Failed,
        }
    }

    fn load_pairs(&self) -> Result<Vec<CookiePair>, VaultError> {
        let Some(secret) = self.store.load().map_err(VaultError::Store)? else {
            return Ok(Vec::new());
        };
        let raw = std::str::from_utf8(&secret).map_err(|_| VaultError::StoredSecretInvalid)?;
        parse_cookie_header(raw).map_err(|_| VaultError::StoredSecretInvalid)
    }

    fn replace(&self, raw: &str) -> Result<Vec<CookiePair>, VaultError> {
        let next = parse_cookie_header(raw).map_err(VaultError::Parse)?;
        self.store
            .replace(&serialize_pairs(&next))
            .map_err(VaultError::Store)?;
        Ok(next)
    }

    fn clear(&self) -> Result<(), VaultError> {
        self.store.clear().map_err(VaultError::Store)?;
        Ok(())
    }

    pub(crate) fn cookie_header(&self) -> Result<Option<String>, String> {
        let pairs = self.load_pairs().map_err(|error| error.to_string())?;
        if pairs.is_empty() {
            return Ok(None);
        }
        String::from_utf8(serialize_pairs(&pairs))
            .map(Some)
            .map_err(|_| VaultError::StoredSecretInvalid.to_string())
    }
}

pub(crate) struct SharedCookieVault(pub CookieVault);

impl Default for SharedCookieVault {
    fn default() -> Self {
        Self(CookieVault::new(Arc::new(KeychainSecretStore::default())))
    }
}

fn ensure_main(webview: &Webview) -> Result<(), String> {
    if webview.label() == "main" {
        Ok(())
    } else {
        Err("cookie-command:untrusted-webview".to_string())
    }
}

#[tauri::command]
pub(crate) fn get_youtube_cookie_status(
    webview: Webview,
    vault: State<'_, SharedCookieVault>,
) -> Result<CookieVaultStatus, String> {
    ensure_main(&webview)?;
    Ok(vault.0.status())
}

#[tauri::command]
pub(crate) fn save_youtube_cookies(
    webview: Webview,
    vault: State<'_, SharedCookieVault>,
    raw: String,
) -> Result<CookieVaultStatus, String> {
    ensure_main(&webview)?;
    vault.0.replace(&raw).map_err(|error| error.to_string())?;
    Ok(CookieVaultStatus::Saved)
}

#[tauri::command]
pub(crate) fn clear_youtube_cookies(
    webview: Webview,
    vault: State<'_, SharedCookieVault>,
) -> Result<CookieVaultStatus, String> {
    ensure_main(&webview)?;
    vault.0.clear().map_err(|error| error.to_string())?;
    Ok(CookieVaultStatus::Missing)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{atomic::AtomicBool, Mutex};

    #[derive(Default)]
    struct MemorySecretStore {
        secret: Mutex<Option<Vec<u8>>>,
        fail_replace: AtomicBool,
    }

    impl SecretStore for MemorySecretStore {
        fn load(&self) -> Result<Option<Vec<u8>>, SecretStoreError> {
            Ok(self.secret.lock().unwrap().clone())
        }

        fn replace(&self, secret: &[u8]) -> Result<(), SecretStoreError> {
            if self.fail_replace.load(std::sync::atomic::Ordering::Relaxed) {
                return Err(SecretStoreError::Write);
            }
            *self.secret.lock().unwrap() = Some(secret.to_vec());
            Ok(())
        }

        fn clear(&self) -> Result<(), SecretStoreError> {
            *self.secret.lock().unwrap() = None;
            Ok(())
        }
    }

    #[test]
    fn parses_first_equals_trims_segments_and_keeps_last_duplicate() {
        let pairs = parse_cookie_header("  alpha=one== ; beta=two; alpha=latest=  ").unwrap();
        assert_eq!(pairs.len(), 2);
        assert_eq!(pairs[0].name, "alpha");
        assert_eq!(pairs[0].value, "latest=");
        assert_eq!(pairs[1].name, "beta");
    }

    #[test]
    fn rejects_attributes_invalid_tokens_controls_size_and_key_limit() {
        for invalid in ["", "missing", "bad key=value", "Path=/", "a=ok\nb=bad"] {
            assert!(parse_cookie_header(invalid).is_err());
        }
        assert_eq!(
            parse_cookie_header(&format!("a={}", "x".repeat(MAX_COOKIE_INPUT_BYTES))).unwrap_err(),
            ParseError::InputTooLarge
        );
        let too_many = (0..=MAX_COOKIE_KEYS)
            .map(|index| format!("key{index}=value"))
            .collect::<Vec<_>>()
            .join(";");
        assert_eq!(
            parse_cookie_header(&too_many).unwrap_err(),
            ParseError::TooManyKeys
        );
    }

    #[test]
    fn invalid_replacement_keeps_previous_secret_and_clear_removes_it() {
        let store = Arc::new(MemorySecretStore::default());
        let vault = CookieVault::new(store.clone());
        vault.replace("alpha=first").unwrap();
        assert!(vault.replace("invalid").is_err());
        assert_eq!(store.load().unwrap(), Some(b"alpha=first".to_vec()));
        store
            .fail_replace
            .store(true, std::sync::atomic::Ordering::Relaxed);
        assert!(vault.replace("alpha=second").is_err());
        assert_eq!(store.load().unwrap(), Some(b"alpha=first".to_vec()));
        store
            .fail_replace
            .store(false, std::sync::atomic::Ordering::Relaxed);
        vault.clear().unwrap();
        assert_eq!(vault.status(), CookieVaultStatus::Missing);
    }

    #[test]
    fn debug_and_errors_never_reveal_cookie_material() {
        let pair = parse_cookie_header("secret_name=fictional_cookie_value")
            .unwrap()
            .remove(0);
        assert_eq!(format!("{pair:?}"), "CookiePair([REDACTED])");
        assert!(!ParseError::InvalidKey
            .to_string()
            .contains("fictional_cookie_value"));
        assert!(!VaultError::StoredSecretInvalid
            .to_string()
            .contains("secret_name"));
    }

    #[test]
    fn production_and_development_keychain_services_are_distinct() {
        assert_ne!(
            keychain_service("com.listenup.desktop"),
            keychain_service("com.listenup.desktop.dev")
        );
        assert!(
            keychain_service(env!("LISTENUP_BUNDLE_ID")).starts_with(env!("LISTENUP_BUNDLE_ID"))
        );
    }
}
