import axios from 'axios'

const client = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
})

let accessToken = null

export const setAccessToken = (token) => { accessToken = token }
export const clearAccessToken = () => { accessToken = null }
export const getAccessToken = () => accessToken

client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true })
        setAccessToken(data.access_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return client(original)
      } catch {
        clearAccessToken()
      }
    }
    return Promise.reject(err)
  }
)

export default client
