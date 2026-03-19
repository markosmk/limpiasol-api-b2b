/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parse as yamlParse, stringify as yamlStringify } from "yaml"

const DOCS_DIR = join(process.cwd(), "docs")
const DOMAINS_DIR = join(DOCS_DIR, "domains")
const OUTPUT_FILE = join(DOCS_DIR, "openapi.yaml")
const BASE_FILE = join(DOCS_DIR, "openapi.base.yaml")

async function bundleOpenApi() {
  console.log("Bundling OpenAPI spec...")

  // 1. Cargar base spec
  const baseSpec = yamlParse(readFileSync(BASE_FILE, "utf-8"))

  // 2. Cargar todos los archivos de dominios
  const domainFiles = readdirSync(DOMAINS_DIR).filter((f) => f.endsWith(".yaml"))

  const paths: Record<string, any> = {}
  const schemas: Record<string, any> = {}

  for (const file of domainFiles) {
    console.log(`  📦 Processing ${file}...`)
    const content = readFileSync(join(DOMAINS_DIR, file), "utf-8")
    const domainSpec = yamlParse(content)

    // Merge paths
    if (domainSpec.paths) {
      Object.assign(paths, domainSpec.paths)
    }

    // Merge schemas
    if (domainSpec.components?.schemas) {
      Object.assign(schemas, domainSpec.components.schemas)
    }
  }

  // 3. Construir spec final
  const finalSpec = {
    ...baseSpec,
    paths,
    components: {
      ...baseSpec.components,
      schemas: {
        ...baseSpec.components?.schemas,
        ...schemas
      }
    }
  }

  // 4. Transformar refs externas a internas recursivamente antes de stringificar
  // Reemplazamos "../openapi.base.yaml#/" y cualquier "nombre_archivo.yaml#/" por "#/"
  function resolveRefs(obj: any): any {
    if (typeof obj === "string") {
      return obj.replace(/(\.\.\/openapi\.base\.yaml|[\w-]+\.yaml)#\//g, "#/")
    }
    if (obj && typeof obj === "object") {
      if (Array.isArray(obj)) {
        return obj.map(resolveRefs)
      }
      const newObj: any = {}
      for (const key in obj) {
        newObj[key] = resolveRefs(obj[key])
      }
      return newObj
    }
    return obj
  }

  const processedSpec = resolveRefs(finalSpec)

  // 5. Escribir archivo bundlead
  const yamlContent = yamlStringify(processedSpec, {
    indent: 2,
    sortMapEntries: true,
    singleQuote: true
  })

  writeFileSync(OUTPUT_FILE, yamlContent, "utf-8")

  const sizeKB = (Buffer.byteLength(yamlContent) / 1024).toFixed(2)
  console.log(`Bundled: ${OUTPUT_FILE} (${sizeKB} KB)`)
  console.log(`Domains included: ${domainFiles.join(", ")}`)
}

bundleOpenApi().catch((err) => {
  console.error("Error bundling:", err)
  process.exit(1)
})
