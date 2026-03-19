// Convention for modules:
// key: "modules:{moduleName}"
// category: "modules"
// value: { enabled: boolean, config: {...}, updatedAt: string }

export type ModuleConfig<T> = {
  enabled: boolean
  config: T
  updatedAt?: string
}
