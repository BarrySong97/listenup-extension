/**
 * @purpose components/ui 的导出面。
 * @role    对外统一入口，调用方从这里 import 而不是深链具体文件。
 * @deps    ./Dropdown
 * @gotcha  新增共享基础件时记得在这里导出
 */
export { Dropdown, type DropdownItem } from './Dropdown';