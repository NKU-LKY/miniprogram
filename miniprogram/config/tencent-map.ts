/**
 * 腾讯位置服务 Key
 * 在 https://lbs.qq.com/ 申请 WebServiceAPI Key，并绑定本小程序 AppID。
 * 同时在微信公众平台 → 开发管理 → 开发设置 → 服务器域名 中添加：
 *   request 合法域名：https://apis.map.qq.com
 *
 * 若地点又变回经纬度，常见原因：
 * 1. Key 每日免费额度用尽（status 121）—— 控制台提升配额或次日重试
 * 2. Key 未绑定本小程序 AppID（status 110/311）
 * 3. 开发者工具未勾选「不校验合法域名」且未配置服务器域名
 */
export const TENCENT_MAP_KEY = 'W52BZ-R5O6W-32KRP-3FCRP-QOVGS-2RBPE'
