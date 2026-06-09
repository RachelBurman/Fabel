const messages = require('../messages/en.json')

function resolve(namespace, key) {
  const ns = namespace ? messages[namespace] : messages
  if (!ns || typeof ns !== 'object') return key
  const parts = key.split('.')
  let val = ns
  for (const part of parts) {
    if (val == null || typeof val !== 'object') return key
    val = val[part]
  }
  return typeof val === 'string' ? val : key
}

const useTranslations = (namespace) => (key, params) => {
  let val = resolve(namespace, key)
  if (params && typeof val === 'string') {
    val = Object.entries(params).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), val)
  }
  return val
}

const getTranslations = async (namespace) => useTranslations(namespace)

const NextIntlClientProvider = ({ children }) => children

const getMessages = async () => messages

module.exports = { useTranslations, getTranslations, NextIntlClientProvider, getMessages }
