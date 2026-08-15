/**
 * @purpose Chrome Web Store 商店图第一轮视觉草案的浏览器预览入口。
 * @role    展示三个可切换的 1280×800 商店图方向，供选型后继续精修。
 * @deps    ./ConceptGallery
 * @gotcha  这是设计辅助路由，不进入官网导航；选型完成前不要当正式商店素材导出。
 */
import { ConceptGallery } from "./ConceptGallery";

export default function StoreShotConceptsPage() {
  return <ConceptGallery />;
}
