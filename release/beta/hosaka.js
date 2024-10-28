const $ = console.log.bind(console)

/** @typedef {'file' | 'directory'} ResourceType */

/** @typedef {'html' | 'text'} ContentType */

/**
 * @typedef {{
 *   name: string
 *   type: ResourceType
 *   content: ContentType
 * }} Resource
 */

/**
 * @typedef {{
 *   resources: Resource[]
 * }} DirIndex
 */

async function main() {
  // @ts-ignore
  const url = new URL(window.location)
  // $(`main> URL=%o`, url)
  const dirParts = url.pathname.split(`/`).filter(Boolean)
  dirParts.pop()
  const dir = dirParts.join(`/`)
  // $(`main> PathName=%o Dir=%o`, url.pathname, dir)

  const txt = await getFile(`_index.tsv`)
  const index = parseIndexTsv(txt)


  $(`main> IdxRes=%o`, index.resources)
  const html = renderDirIndex({
    domain: url.hostname,
    dir,
    resources: index.resources,
  })
  fillDirIndex(index.resources)
  fillDirReadme()

  document.body.innerHTML = html
}

/**
 * @param {{
 * domain: string
 * dir: string
 * resources: Resource[]
 * }} args
 * @returns {string}
 */
function renderDirIndex(args) {
  $(`renderDirIndex> Args=%o`, args)
  const { domain, dir, resources } = args

  let dirLink = `<a href="/index.html">${domain}</a>`

  if (dir !== `.`) {
    const parts = dir.split(`/`)
    const levels = parts.length - 1
    // $(`renIdx> Parts=%o Levels=%o`, parts, levels)

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      // $(`renIdx> for> I=%o Part=%o`, i, part)
      if (!part) {
        continue
      }

      dirLink += `/`

      // If this is the last one, no link.
      if (i === parts.length - 1) {
        $(`renIx> for> This is the last part.`)
        dirLink += part
        continue
      }

      dirLink += `<a href="${`../`.repeat(levels - 1)}${part}/">${part}</a>`
    }
  }

  const title = `
    <h1>
      <tt>${dirLink}</tt>
    </h1>
  `

  /** @type {string[]} */
  const table = []

  table.push(`
    <table class="list filesys">
      <thead>
        <tr>
          <th class="left name">Name</th>
          <th class="size">Size</th>
          <th class="modified">Modified</th>
        </tr>
      </thead>
      <tbody>
  `)

  // for (const resource of resources) {
  for (let idx = 0; idx < resources.length; idx++) {
    const id = idx + 1
    const resource = resources[idx]
    const { name } = resource
    const modified = new Date()

    /** @type {string} */
    let link

    /** @type {string} */
    let size

    if (resource.type === `directory`) {
      link = `<strong><a href="${name}/index.html">${name}</a>/</strong>`
      size = ``
    } else {
      link = `<a href="${name}">${name}</a>`
      // size = String(item.stats.size)
      size = `1000`
    }

    table.push(`
      <tr id="resource-${id}">
        <td class="left">
          <tt id="resource-${id}-filename" class="filename">${link}</tt>
        </td>
        <td class="right">
          <span id="resource-${id}-size" class="size">${size}</span>
        </td>
        <td class="center">
          <span id="resource-${id}-modified" class="modified">${modified.toLocaleString()}</span>
        </td>
      </tr>
    `)
  }

  table.push(`
      </tbody>
    </table>
  `)

  return `
    <div id="index">
      ${title}
      ${table.join('')}
    </div>
  `
}

async function fillDirReadme() {
  const readme = await downloadReadme()
  if (!readme) {
    return
  }


  let readmeHtml = ``
  readmeHtml += `<hr/>`
  if (readme.type === `txt`) {
    readmeHtml += `<pre>${readme.content}</pre>`
  } else {
    readmeHtml += readme.content
  }

  const readmeEl = document.createElement(`div`)
  readmeEl.id = `readme`
  readmeEl.innerHTML = readmeHtml

  const indexEl = expectEl(`index`)
  indexEl.appendChild(readmeEl)
}

/**
 * @param {Resource[]} resources
 * @returns {Promise<void>}
 */
async function fillDirIndex(resources) {
  // for (const { name, type } of resources) {
  for (let idx = 0; idx < resources.length; idx++) {
    const resource = resources[idx]
    const { name, type } = resource
    if (type === `directory`) {
      continue
    }

    const id = idx + 1
    const headers = await headFile(name)
    $(`fillDirIndex> ResourceId=%o Name=%o Headers=%o`, id, name, headers)


    const sizeEl = expectResourceProp(id, `size`)
    sizeEl.textContent = headers[`Content-Length`]

    const lastModified = headers[`Last-Modified`]
    const modified = new Time(lastModified)
    const modifiedEl = expectResourceProp(id, `modified`)
    modifiedEl.textContent = modified.human
  }
}

/**
 * @param {string} txt
 * @returns {DirIndex}
 */
function parseIndexTsv(txt) {
  const lines = txt.split(`\n`)

  const dirs = {}
  const files = {}

  for (const line of lines) {
    const cols = line.trim().split(`\t`)
    const [type, name, opts] = cols
    // $(`parseIndexTsv> Line=%o Cols=%o`, line, cols)
    $(`parseIndexTsv> Type=%o Name=%o Opts=%o`, type, name, opts)

    if (type === `d`) {
      dirs[name] = { name, type: `directory` }
    } else if (type === `f`) {
      files[name] = { name, type: `file` }
    }
  }

  /** @type {DirIndex} */
  const dirIndex = { resources: [] }

  const dirNames = Object.keys(dirs).sort()
  const fileNames = Object.keys(files).sort()
  $(`parseIndexTsv> DirNames=%o`, dirNames)
  $(`parseIndexTsv> FileNames=%o`, fileNames)

  for (const name of dirNames) {
    const dir = dirs[name]
    $(`parseIndexTsv> forDirs> Name=%o Dir=%o`, name, dir)
    dirIndex.resources.push(dir)
  }

  for (const name of fileNames) {
    const dir = files[name]
    dirIndex.resources.push(dir)
  }

  return dirIndex
}

/** @param {string} url */
async function getFile(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }

  const txt = await res.text()
  // $(`download> Txt:\n%s`, txt)

  return txt
}

/**
 * @typedef {{
 *   'Last-Modified': string
 *   'Content-Length': string
 *   'Content-Type': string
 * }} FileHeaderMap
 */

/**
 * @param {string} url
 * @returns {Promise<FileHeaderMap>}
 */
async function headFile(url) {
  $(`headFile> Url=%o`, url)
  const res = await fetch(url, { method: `HEAD` })
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }

  // const h = {}
  // for (const [k, v] of res.headers.entries()) {
  //   h[k] = v
  // }
  // $(`headFile> AllHeaders=%o`, h)

  const headerKeys = [
    `Last-Modified`,
    `Content-Length`,
    `Content-Type`,
  ]

  /** @type {Partial<FileHeaderMap>} */
  const headerValues = {}

  for (const key of headerKeys) {
    const value = res.headers.get(key)
    if (value) {
      headerValues[key] = value
    }
  }

  // $(`headFile> Headers=%o`, headerValues)

  // @ts-ignore
  return headerValues
}

/** @returns {Promise<{ type: 'html' | 'txt', content: string } | undefined>} */
async function downloadReadme() {
  try {
    const content = await getFile(`_readme.html`)
    return { type: `html`, content }
  } catch(err) {}

  try {
    const content = await getFile(`_readme.txt`)
    return { type: `txt`, content }
  } catch(err) {}
}

class Time {
  /** @type {Date} */
  date

  /** @type {string | undefined} */
  #iso

  /** @type {number | undefined} */
  #unixMs

  /** @type {number | undefined} */
  #unix

  /** @type {string | undefined} */
  #http

  /** @type {string | undefined} */
  #human

  /** @returns {string} */
  get iso() {
    if (this.#iso !== undefined) {
      return this.#iso
    }

    this.#iso = this.date.toISOString()

    return this.#iso
  }

  /** @returns {number} */
  get unixMs() {
    if (this.#unixMs !== undefined) {
      return this.#unixMs
    }

    this.#unixMs = Number(this.date)

    return this.#unixMs
  }

  /** @returns {number} */
  get unix() {
    if (this.#unix !== undefined) {
      return this.#unix
    }

    this.#unix = Math.floor(this.unixMs / 1000)

    return this.#unix
  }

  /** @returns {string} */
  get http() {
    if (this.#http !== undefined) {
      return this.#http
    }

    this.#http = this.date.toUTCString()

    return this.#http
  }

  /** @returns {string} */
  get human() {
    if (this.#human !== undefined) {
      return this.#human
    }

    this.#human = this.date.toLocaleString()

    return this.#human
  }

  /** @param {string | Date} [a] */
  constructor(a) {
    if (a instanceof Date) {
      this.date = a
      return
    }

    if (!a) {
      this.date = new Date()
      return
    }

    if (/\d/.test(a[0])) {
      this.#iso = a
    } else {
      this.#http = a
    }

    this.date = new Date(a)
    this.zero()
  }

  /** @returns {void} */
  zero() {
    // The If-Modified-Since HTTP header can't send milliseconds so it'll always
    // appear to be off if compared to the same thing in Date form.
    this.date.setMilliseconds(0)
  }
}

/**
 * @param {number} id
 * @param {'size' | 'modified'} property
 * @returns {HTMLElement}
 */
function expectResourceProp(id, property) {
  const htmlId = `resource-${id}-${property}`
  return expectEl(htmlId)
}

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function expectEl(id) {
  const el = document.getElementById(id)
  if (!el) {
    throw new Error(`Expected to find HTML element with id="${id}"`)
  }

  return el
}

main()