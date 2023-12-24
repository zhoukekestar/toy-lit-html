/**
 * Document tree walker
 */
const walker = document.createTreeWalker(
  document.body,
  NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT
)

/**
 * html template literials
 */
export const html = (strings, ...values) => ({
  strings,
  values
})

/**
 * ChildPart
 * 需指定开始节点，结束节点，父节点
 */
class ChildPart {
  constructor (startNode, endNode) {
    this._$startNode = startNode
    this._$endNode = endNode
  }

  /**
   * 更新文档的核心接口
   * 会渲染模板、文本节点，执行相关的插入、更新操作
   */
  _$setValue (value) {
    if (typeof value != 'object' && typeof value != 'function') {
      /**
       * 如果是文本，则插入 DOM 对象
       */
      this._commitText(value)
    } else {
      /**
       * 如果是模板的情况
       */
      this._commitTemplateResult(value)
    }
  }

  /**
   * 新建或更新一个文本节点，并插入或更新 DOM
   */
  _commitText (value) {

    // 值相等的情况，直接跳过
    if (this._$committedValue === value) return

    if (this._$committedValue) {

      // 如果之前有值，说明当前 childpart 已经有插入操作了
      // 那么这次就需要走更新逻辑
      this._$startNode.nextSibling.data = value

    } else {

      // 没有任何插入记录，说明 childpart 需要新建一个 dom 到文档上
      this._commitNode(document.createTextNode(value))

    }

    // 用于判断是否是二次更新
    this._$committedValue = value
  }

  /**
   * 渲染模板，并将渲染后的 dom，插入到文档中
   */
  _commitTemplateResult (result) {
    const { values } = result

    // 新建或获取当前模板
    const template = this._$getTemplate(result)

    if (this._$committedValue?._$template === template) {

      // 之前有 commit 记录，则走更新逻辑
      // 即拿到 templateinstance，然后 instance._update(values)
      this._$committedValue._update(values)

    } else {

      // 新建模板实例
      // 用于更新节点
      const instance = new TemplateInstance(template, this)
      const fragment = instance._clone()

      // 更新当前值到模板中
      instance._update(values)

      // 把渲染好的模板，插入当前文档中
      this._commitNode(fragment)

      // 用来标记第二次的更新判断
      this._$committedValue = instance
    }
  }

  /**
   * 获取 Template
   */
  _$getTemplate (result) {

    let template = cacheTemplates.get(result.strings)
    if (template === undefined) {
      // 新建模板，并做缓存
      // 用于加速、对比是否相同
      template = new Template(result)
      cacheTemplates.set(result.strings, template)
    }

    return template
  }

  /**
   * 提交节点
   */
  _commitNode (node) {
    this._insert(node)
  }

  /**
   * 执行插入节点操作
   */
  _insert (node) {
    return this._$startNode.parentNode.insertBefore(node, this._$endNode)
  }
}

const cacheTemplates = new WeakMap()

/**
 * 对字符串模板插入标记位，用于后续变量的引用
 */
function getTemplateHtml (strings) {
  const marker = '<?lit$123456$>'
  return strings.join(marker)
}

/**
 * Template
 * 将当前字符串模板，放到 template 元素总，由浏览器生成 dom 结构
 */
class Template {
  constructor ({ strings }) {
    const html = getTemplateHtml(strings)
    this.el = Template.createElement(html)
  }

  static createElement (html) {
    const el = document.createElement('template')
    el.innerHTML = html
    return el
  }
}

/**
 * 模板实例
 * 用于将模板导入，并绑定变量到 childpart 等实例上
 */
class TemplateInstance {
  constructor (template, parent) {
    this._$template = template
    this._$parent = parent
  }

  _clone () {
    const {
      el: { content }
    } = this._$template
    const fragment = document.importNode(content, true)
    walker.currentNode = fragment
    this._$parts = []
    let node = null
    while ((node = walker.nextNode()) !== null) {
      /**
       * 找到变量的标记位，然后新建并绑定一个 childpart
       */
      if (node.nodeType === Node.COMMENT_NODE) {
        this._$parts.push(new ChildPart(node, node.nextSibling))
      }
    }

    return fragment
  }

  /**
   * 更新 part 的值，每个 part 会执行插入、更新到 real dom 等操作
   */
  _update (values) {
    for (let i = 0; i < this._$parts.length; i++) {
      this._$parts[i]._$setValue(values[i])
    }
  }
}

/**
 * render function
 */
export const render = (html, container) => {
  /**
   * 没有初始化的情况下，新建 ChildPart
   * 并添加一个起始节点标记位
   */
  if (!container._childpart) {
    const startNode = document.createComment('')
    container.appendChild(startNode)
    container._childpart = new ChildPart(startNode, null, container)
  }

  /**
   * 渲染制定模板
   */
  let part = container._childpart
  part._$setValue(html)
}
