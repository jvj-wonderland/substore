const APP_NAME = "SubStore"

export function pageTitle(page?: string) {
  return page ? `${page} | ${APP_NAME}` : APP_NAME
}
