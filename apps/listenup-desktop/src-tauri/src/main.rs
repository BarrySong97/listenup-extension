// @purpose 桌面端可执行入口，直接调 lib::run()。
// @role    二进制的最外层壳，逻辑全在 lib.rs。
// @deps    listenup_desktop crate
// @gotcha  别往这里加逻辑；GUI/桥接的分叉在 lib.rs 的 run() 开头
fn main() {
    listenup_desktop::run();
}
