// In local development, Vite proxies /api and /uploads to FastAPI.
// Set VITE_API_URL only when frontend and backend are hosted separately.
const API_URL = import.meta.env.VITE_API_URL ?? ''
function authHeaders(): Record<string,string> {
  const initData = (window as any).Telegram?.WebApp?.initData
  if (initData) return { 'X-Telegram-Init-Data': initData }
  // Only for local browser testing. Disable ALLOW_DEV_AUTH before public deployment.
  return { 'X-Dev-Telegram-User-ID': localStorage.getItem('ink_dev_user_id') || '100001' }
}
export async function api<T>(path:string, options:RequestInit={}):Promise<T> {
  const isForm = options.body instanceof FormData
  const headers = new Headers(authHeaders())
  if (!isForm) headers.set('Content-Type', 'application/json')
  new Headers(options.headers).forEach((value, key) => headers.set(key, value))
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers })
  } catch {
    throw new Error('Не удаётся связаться с сервером. Проверь, что backend запущен на http://127.0.0.1:8000 и в его терминале нет ошибки.')
  }
  const data = await response.json().catch(()=>({}))
  if(!response.ok) throw new Error(data.detail || `API error: ${response.status}`)
  return data as T
}
export const get=<T,>(path:string)=>api<T>(path)
export const post=<T,>(path:string,body?:unknown)=>api<T>(path,{method:'POST',body:body instanceof FormData?body:JSON.stringify(body??{})})
export const patch=<T,>(path:string,body?:unknown)=>api<T>(path,{method:'PATCH',body:JSON.stringify(body??{})})
export const put=<T,>(path:string,body?:unknown)=>api<T>(path,{method:'PUT',body:JSON.stringify(body??{})})
export const mediaUrl=(path:string)=>path.startsWith('http')?path:`${API_URL}${path}`
