// 跨组件同步登录/登出状态：登录/注册成功写入缓存后 dispatch 该事件，
// AuthMenu 监听后立即刷新右上角用户区，避免 SPA 导航下组件不重挂载、
// 状态仍是旧值而需要手动刷新页面。
export const AUTH_CHANGED_EVENT = "xiye:auth-changed";
export const AUTH_CACHE_KEY = "xiye-auth-cache";