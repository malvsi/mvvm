
const compileUtil = {
    getValue(vm, expr) { // 提取对应表达是 expr 在 data 中的值
        
        return expr.trim().split('.').reduce((accumulator, currentValue) => {
            return accumulator[currentValue]
        }, vm.$data)
    },
    setValue(vm, expr, newValue) {

        let exprs = expr.trim().split('.'), len = exprs.length
        exprs.reduce((accumulator, currentValue, currentIndex) => {
            if(len === currentIndex + 1) {
                accumulator[currentValue] = newValue
            }else {
                return accumulator[currentValue]
            }
        }, vm.$data)
    },
    on(node, expr, vm, eventName) {

        // 判断事件中是否有参数
        if(/.+?\((.+?)\)/.test(expr)) {

            // console.log('方法有参数的: ', expr);
            // 提取 方法 名称
            const [methodName, ] = expr.split('(')            
            // 提取 方法 中的 参数
            expr.replace(/\((.+?)\)/, (...args)=> {

                // 方法 的参数集合
                const params = []
                // 对多个 参数 进行分割 push 进参数集合中
                args[1].split(',').forEach(param => {

                    const value = compileUtil.getValue(vm, param)
                    params.push(value)
                })
                const method = vm.$methods && vm.$methods[methodName]
                // 给 node 节点添加事件
                node.addEventListener(eventName, method.bind(vm, ...params), false)
            })
        } else {

            // console.log('方法没有参数: ', expr);
            const method = vm.$methods && vm.$methods[expr]
            node.addEventListener(eventName, method.bind(vm), false)
        }
    },
    newWatcher(vm, expr, node, type) { // 创建观察者，把新值渲染到视图中去
        new Watcher(vm, expr, newValue => {
            this.updater[`${type}Update`](node, newValue)
        })
    },
    getTextContent(expr, vm) {
        return expr.trim().replace(/\{\{(.+?)\}\}/g, (...args)=> {
            return this.getValue(vm, args[1])
        })
    },
    text(node, expr, vm) {
        /**
         * 分为两种情况
         * 1. 处理 v-text 指令时，直接赋值
         * 2. 处理 {{ person.name }} -- {{ person.age }} 文本指令时，需要提取 value 在进行赋值
         */
        let value
        if(expr.indexOf('{{') !== -1) {
            value = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {

                // console.log(args[1]);
                new Watcher(vm, args[1], () => {
                    this.updater.textUpdate(node, this.getTextContent(expr, vm))
                })
                return this.getValue(vm, args[1])
                // this.updater.textUpdate(node, value)
            })
        } else {
            this.newWatcher(vm, expr, node, 'text')
            value = this.getValue(vm, expr)
        }
        this.updater.textUpdate(node, value)
    },
    html(node, expr, vm) {

        const value = this.getValue(vm, expr)
        this.newWatcher(vm, expr, node, 'html')
        this.updater.htmlUpdate(node, value)
    },
    model(node, expr, vm) {

        const value = this.getValue(vm, expr)
        this.newWatcher(vm, expr, node, 'model')
        node.addEventListener('input', e => { // 数据同步更改

            this.setValue(vm, expr, e.target.value)
        })
        this.updater.modelUpdate(node, value)
    },
    bind(node, expr, vm, dirName) {
        const value = this.getValue(vm, expr)
        this.updater.dirUpdate(node, dirName, value)
    },
    updater: {
        dirUpdate(node, attrName, attrValue) {
            node.setAttribute(attrName, attrValue)
        },
        htmlUpdate(node, value) {
            node.innerHTML = value
        },
        textUpdate(node, value) {
            node.textContent = value
        },
        modelUpdate(node, value) {
            node.value = value
        }
    }
}


/**
 * 节点指令解析
 */
class Compile{
    constructor(el, vm) {
        this.vm = vm
        // 1.获取根元素
        this.el = this.isNodeElement(el) ? el : document.querySelector(el)
        // 2.获取文档流碎片
        const frament = this.nodeToFragment(this.el)
        // 3.编译指令并处理
        this.compile(frament)
        // 4.把文档流碎片重新追加到 根元素 中
        this.el.appendChild(frament)
    }

    /**
     * 编译解析碎片
     */
    compile(fragment) {
        if(!fragment) return
        // 拿到所有的 子元素
        let childrens = fragment.childNodes;

        [...childrens].forEach(child => {
            
            if(child.nodeType === 1) { // 如果子元素是 元素节点
                this.compileElement(child)
            } else if(child.nodeType === 3) { // 如果子元素是 文本节点
                this.compileText(child)
            }

            // 如果元素还有子节点 则递归获取其子元素
            if(child.childNodes && child.childNodes.length) {
                this.compile(child)
            }
        })
    }

    compileElement(node) {
        // 提取 节点 的属性
        const attrs = node.attributes;
        
        [...attrs].forEach(attr => {
            const {nodeName, nodeValue} = attr

            if(this.isDirect(nodeName)) {
                // console.log(attr);
                // 1.获取 属性名 和 属性值
                // 2.分析属性名 direct = [bind:src text html on:click model]
                const [, direct] = nodeName.split('-')
                // 3.dirName = [bind, text, html, on, model] eventName = [src, click]
                const [dirName, eventName] = direct.split(':')
                // 4.根据 指令 进行数据绑定解析
                compileUtil[dirName](node, nodeValue, this.vm, eventName)
                // 5.数据和视图处理完之后 在节点中删除特殊指令的属性
                node.removeAttribute(nodeName)

            } else if(this.isSpecialEvent(nodeName)) { // @click @change 这种特殊指令
                const [, eventName] = nodeName.split('@')
                compileUtil['on'](node, nodeValue, this.vm, eventName)
                node.removeAttribute(nodeName)
                
            } else if(this.isSpecialAttr(nodeName)) { // :href :src 这种特殊指令
                const [, direct] = nodeName.split(':')
                compileUtil['bind'](node, nodeValue, this.vm, direct)
                node.removeAttribute(nodeName)

            }
        })
    }

    isSpecialEvent(attr) {
        return attr.startsWith('@')
    }

    isSpecialAttr(attr) {
        return attr.startsWith(':')
    }

    isDirect(attr) {
        return attr.startsWith('v-')
    }

    compileText(textNode) {
        const textContent = textNode.textContent
        if(textContent.indexOf('{{') !== -1) {
            compileUtil['text'](textNode, textContent, this.vm)
        }
    }

    isNodeElement(node) {
        return node.nodeType === 1
    }

    /**
     * dom 元素转为 fragment 碎片
     */
    nodeToFragment(node) {
        // 创建文档碎片
        const fragment = document.createDocumentFragment()
        let firstChild;
        // 循环提取根元素的第一个元素 把它放到 fragment 碎片中
        while(firstChild = node.firstChild) {
            fragment.appendChild(firstChild) // 此时 root的子元素会从root中剔除
        }
        return fragment
    }
}

class Vue{
    constructor(options) {
        this.$el = options.el
        this.$options = options
        this.$data = options.data
        this.$methods = options.methods
        // 数据观察和指令解析   
        if(this.$el) {
            // 添加观察者，数据劫持
            new Observer(this.$data)
            // 指令解析
            new Compile(this.$el, this)
            // this 代理
            this.proxyData(this.$data)
        }
    }

    // this 代理
    proxyData(obj) {
        // 遍历 data 数据
        for(const key in obj) {

            Object.defineProperty(this, key, {
                set: newValue => {
                    obj[key] = newValue
                },
                get() {
                    return obj[key]
                }
            })
        }
    }
}