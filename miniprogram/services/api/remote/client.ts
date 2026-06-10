import { API_BASE_URL, DEFAULT_AVATAR_URL, DEFAULT_OBS_PHOTO_URL } from '../config'

interface ApiEnvelope<T = unknown> {
  success: boolean
  data?: T
  message?: string
}

export function resolveMediaUrl(path?: string | null, kind: 'avatar' | 'photo' = 'photo'): string {
  if (!path || !path.trim()) {
    return kind === 'avatar' ? DEFAULT_AVATAR_URL : DEFAULT_OBS_PHOTO_URL
  }
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('wxfile://')) {
    return path
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts: string[] = []
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  })
  return parts.length ? `?${parts.join('&')}` : ''
}

export function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    data?: Record<string, unknown>
    query?: Record<string, string | number | boolean | undefined | null>
  } = {},
): Promise<T> {
  const { method = 'GET', data, query } = options
  const url = `${API_BASE_URL}${path}${query ? buildQuery(query) : ''}`

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header: { 'Content-Type': 'application/json' },
      success(res) {
        const body = res.data as ApiEnvelope<T>
        if (res.statusCode >= 200 && res.statusCode < 300 && body && body.success) {
          resolve(body.data as T)
          return
        }
        const message = (body && body.message) || `请求失败 (${res.statusCode})`
        reject(new Error(message))
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络请求失败'))
      },
    })
  })
}

export function uploadFile<T>(
  path: string,
  filePath: string,
  name: string,
  formData: Record<string, string | number> = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE_URL}${path}`,
      filePath,
      name,
      formData: Object.fromEntries(
        Object.entries(formData).map(([key, value]) => [key, String(value)]),
      ),
      success(res) {
        try {
          const body = JSON.parse(res.data) as ApiEnvelope<T>
          if (body.success) {
            resolve(body.data as T)
            return
          }
          reject(new Error(body.message || '上传失败'))
        } catch {
          reject(new Error('上传响应解析失败'))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '上传失败'))
      },
    })
  })
}

export function uploadFiles<T>(
  path: string,
  filePaths: string[],
  name: string,
  formData: Record<string, string | number> = {},
): Promise<T> {
  if (filePaths.length === 0) {
    return request<T>(path, { method: 'POST', data: formData as Record<string, unknown> })
  }
  if (filePaths.length === 1) {
    return uploadFile<T>(path, filePaths[0], name, formData)
  }

  // 微信小程序 uploadFile 单次只能传一个文件，多图需逐个追加或后端支持单文件多次
  return uploadFile<T>(path, filePaths[0], name, formData).then(async (first) => {
    for (let i = 1; i < filePaths.length; i += 1) {
      await uploadFile<unknown>(path, filePaths[i], name, formData)
    }
    return first
  })
}
