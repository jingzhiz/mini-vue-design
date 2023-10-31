// 特殊节点类型的标注
const Text = Symbol('Text')
const Comment = Symbol('Comment')
const Fragment = Symbol('Fragment')

// 使用生成渲染器函数，可以生成不同类型的渲染器
function createRenderer(options = {}) {
  // 针对不同平台的统一 API 风格处理
  const {
    createElement,
    createComment,
    setElementText,
    createTextNode,
    setText,
    insert,
    patchProps
  } = options

  // 挂载普通标签元素
  function mountElement(vnode, container, anchor) {
    const { type, props, children } = vnode
  
    // 使用 type 创建同名标签, 并让 vnode.el 指向真实 dom 元素
    const el = vnode.el = createElement(type)
  
    // 遍历 props, 将属性或事件添加至 DOM 元素上
    if (vnode.props) {
      for(const key in props) {
        patchProps(el, key, null, props[key])
      }
    }

    // 处理 children
    if (isString(children)) {
      // 如果是 string, 作为文本节点处理
      setElementText(el, children)
    } else if (isArray(children)) {
      // 如果是数组就遍历 children, 调用 patch 进行挂载
      children.forEach(child => patch(null, child, el))
    }

    insert(el, container, anchor)
  }

  // 更新普通标签元素
  function patchElement(n1, n2) {
    const el = n2.el = n1.el
    const oldProps = n1.props
    const newProps = n2.props

    // 新旧 props 相互比较进行更新
    for (const key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key])
      }
    }
    for (const key in oldProps) {
      if (!(key in newProps)) {
        patchProps(el, key, oldProps[key], null)
      }
    }

    // 更新子节点
    patchChildren(n1, n2, el)
  }

  function patchChildren(n1, n2, container) {
    if (isString(n2.children)) {
      // 如果 children 是 String 表示更新为文本节点
      if (isArray(n1.children)) {
        // 先卸载所有子元素
        n1.children.forEach(child => unmount(child));
      }
      // 在将文本设置成节点
      setElementText(container, n2.children)
    } else if (isArray(n2.children)) {
      // 如果是数组表示为一组子节点
      if (isArray(n1.children)) {
        // EasyDiffV1(n1, n2, container)
        EasyDiffV2(n1, n2, container)
      } else {
        // n1.children 是文本节点，则清空文本然后遍历 n2.children 进行挂载
        setElementText(container, '')
        n2.children.forEach(child => patch(null, child, container))
      }
    } else {
      // 此分支表示未存在 n2.children
      if (isArray(n1.children)) {
        n1.children.forEach(child => unmount(child))
      } else if (isString(n1.children)) {
        setElementText(container, '')
      } else {
        // 在这里则表示 n1 和 n2 都无 children
      }
    }
  }
  
  // 挂载组件
  function mountComponent(vnode, container) {
    // 调用组件函数，获取组件要渲染的内容
    const subtree = vnode.type.render()
  
    render(subtree, container)
  }

  function unmount(vnode) {
    // 如果是 Fragment 时，只需要卸载 children 即可
    if (vnode.type === Fragment) {
      vnode.children.forEach(child => unmount(child))
      return
    }

    const parent = vnode.el.parentNode
    if (parent) parent.removeChild(vnode.el)
  }

  function patch(n1, n2, container, anchor) {
    // 如果是不同的标签元素，则直接先卸载之前的元素
    if (n1 && n1.type !== n2.type) {
      unmount(n1)
      n1 = null
    }

    // 如过是相同的标签元素
    const { type } = n2

    if (isString(type)) {
      if (!n1) {
        // 挂载
        mountElement(n2, container, anchor)
      } else {
        // 更新
        patchElement(n1, n2)
      }
    } else if (type === Text) {
      // 文本节点的更新
      if (!n1) {
        const el = n2.el = createTextNode(n2.children)
        insert(el, container)
      } else {
        const el = n2.el = n1.el
        if (n2.children !== n1.children) {
          setText(el, n2.children)
        }
      }
    } else if (type === Comment) {
      // 注释类型的更新
      if (!n1) {
        const el = n2.el = createComment(n2.children)
        insert(el, container)
      } else {
        const el = n2.el = n1.el
        if (n2.children !== n1.children) {
          setText(el, n2.children)
        }
      }
    } else if (type === Fragment) {
      // Fragment 片段只要关注 children 即可
      if (!n1) {
        n2.children.forEach(child => patch(null, child, container))
      } else {
        patchChildren(n1, n2, container)
      }
    }

  }

  function render(vnode, container) {
    if (vnode) {
      patch(container._vnode, vnode, container)
    } else {
      // 卸载操作
      if (container._vnode) {
        unmount(container._vnode)
      }
    }

    container._vnode = vnode
  }

  //简单 Diff 算法
  function EasyDiffV1(n1, n2, container) {
    const oldChildren = n1.children
    const newChildren = n2.children
    const oldLen = oldChildren.length
    const newLen = newChildren.length
    const commonLen = Math.min(oldLen, newLen)
  
    // 遍历 length 中较短的一方
    for (let i = 0; i < commonLen; i++) {
      patch(oldChildren[i], newChildren[i], container)
    }
  
    if (newLen > oldLen) {
      // 如果 newLen > oldLen 表示还要新增挂载元素
      for (let i = commonLen; i < newLen; i++) {
        patch(null, newChildren[i], container)
      }
    } else if (newLen < oldLen) {
      // 如果 newLen 《 oldLen 表示还要卸载元素
      for (let i = commonLen; i < oldLen; i++) {
        unmount(oldChildren[i])
      }
    }
  }
  function EasyDiffV2(n1, n2, container) {
    const oldChildren = n1.children
    const newChildren = n2.children

    // 用来存储寻找过程中遇到的最大索引值
    let lastIndex = 0
    for (let i = 0; i < newChildren.length; i++) {
      let find = false
      const newVnode = newChildren[i]
      for(let j = 0; j < oldChildren.length; j++) {
        const oldVnode = oldChildren[j]

        // 如果找到两个相同 key 的节点，表示 vnode 可以复用
        if (newVnode.key === oldVnode.key) {
          find = true
          patch(oldVnode, newVnode, container)
          if (lastIndex > j) {
            const prevNode = newChildren[i - 1]
            if (prevNode) {
              const anchor = prevNode.el.nextSibling
              insert(newVnode.el, container, anchor)
            }
          } else {
            lastIndex = j
          }
          break
        }
      }

      // 如果没有发现则表示该 vnode 是新增的
      if (!find) {
        const prevNode = newChildren[i - 1]
        let anchor = null
        if (prevNode) {
          // 如果有前一个节点，则插入至这个节点的下一个兄弟元素之前
          anchor = prevNode.el.nextSibling
        } else {
          // 否则新节点是第一个子节点，插入到父容器的第一个元素前
          anchor = container.firstChild
        }
        patch(null, newVnode, container, anchor)
      }
    }

    // 在遍历一遍旧节点，看是否是有元素要删除
    for (let i = 0; i < oldChildren.length; i++) {
      const oldVnode = oldChildren[i]
      const has = newChildren.some(vnode => vnode.key === oldVnode.key)
      if (!has) {
        unmount(oldVnode)
      }
    }
  }

  return { render }
}

// 生成渲染函数，将浏览器环境的 API 传至生成渲染器函数中
const { render } = createRenderer({
  createElement(type) {
    return document.createElement(type)
  },
  createTextNode(text) {
    return document.createTextNode(text)
  },
  createComment(comment) {
    return document.createComment(comment)
  },
  setElementText(el, text) {
    el.textContent = text
  },
  setText(el, text) {
    el.nodeValue = text
  },
  insert(el, parent, anchor = null) {
    parent.insertBefore(el, anchor)
  },
  // 针对 property 和 attribute 做不同的处理
  patchProps(el, key, prevValue, nextValue) {
    // on 开头表示是事件
    if (/^on/.test(key)) {
      let invokers = el._vei || (el._vei = {})
      const eventName = key.substring(2).toLocaleLowerCase()
      let invoker = invokers[key]
      if (nextValue) {
        // 如果没有 invoker, 则伪造一个 invoker 缓存到 el._vei
        if (!invoker) {
          invoker = el._vei[key] = (e) => {
            // 如果事件的发生时间小于事件处理函数绑定的时间，则不执行处理函数
            if (e.timeStamp < invoker.attached) return
            // 当伪造的事件处理函数执行时，执行真正的函数
            if (isArray(invoker.value)) {
              invoker.value.forEach(fn => fn(e))
            } else {
              invoker.value(e)
            }
          }
          invoker.value = nextValue
          invoker.attached = performance.now()
          el.addEventListener(eventName, invoker)
        }
      } else if (invoker) {
        // 移除之前绑定的事件处理函数
        el.removeEventListener(eventName, invoker)
      }
    } else if (key === 'class') {
      // 对 class 属性进行特殊处理
      const value = normalizeClass(nextValue)
      el.className = value || ''
    } else if (key === 'style') {
      // 对 style 属性进行特殊处理
      const value = normalizeStyle(nextValue)
      if (isString(value)) {
        el.style.cssText = value
      } else if (isObject(value)) {
        Object.entries(value).forEach(([k, v]) => {
          el.style[k] = v
        })
      } else {
        if (isString) {
          el.style.cssText = ''
        } else if (isObject(prevValue)) {
          Object.entries(prevValue).forEach(([k, v]) => {
            el.style[k] = ''
          })
        }
      }
    } else if (shouldSetAsProps(el, key, nextValue)) {
      if (isBoolean(el[key]) && value === '') {
        el[key] = true
      } else {
        el[key] = nextValue
      }
    } else {
      el.setAttribute(key, nextValue)
    }
  }
})