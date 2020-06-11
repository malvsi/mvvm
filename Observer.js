// 观察者
class Watcher{
    constructor(vm, expr, cb) {
        this.vm = vm
        this.expr = expr
        this.cb = cb
        this.oldValue = this.getOldValue()
    }

    getOldValue() { // 获取旧值的时候定义 收集器 的标志，每 get 一次值都往 Dep 收集器中添加一个观察者
        Dep.target = this
        let oldValue = compileUtil.getValue(this.vm, this.expr)
        Dep.target = null
        return oldValue
    }

    update() {
        let newValue = compileUtil.getValue(this.vm, this.expr)
        // 比较两个值是否发生变化，如果发生变化就把新值返回给回调函数
        if(this.oldValue !== newValue) {
            this.cb(newValue)
        }
    }
}

// 依赖收集
class Dep{
    constructor() {
        this.subs = []
    }

    addSub(watcher) {
        this.subs.push(watcher)
    }

    notify() {
        console.log('触发观察者数据更新');
        this.subs.forEach(watcher => watcher.update())
    }
}

// 数据劫持 添加观察者
class Observer{
    constructor(data) {
        this.observer(data)
    }

    observer(obj) {

        if(obj && typeof obj === 'object') {
            // 遍历每个属性，对属性进行监听劫持
            Object.keys(obj).forEach(key => {
                this.defineReactive(obj, key, obj[key])
            })
        }
    }

    defineReactive(obj, key, value) {
        // 如果值还是一个对象，要继续进行遍历
        if(value && typeof value === 'object') {
            this.observer(value)
        }
        // 定义依赖收集器
        const dep = new Dep()
        // 监听属性
        Object.defineProperty(obj, key, {

            enumerable: true,
            configurable: false,
            set: newValue => {
                // 设置每个值时都要重新对值进行劫持
                this.observer(newValue)
                if(value !== newValue) {
                    value = newValue
                }
                // 通知观察者更新
                dep.notify()
            },
            get() {
                Dep.target && dep.addSub(Dep.target)
                return value
            }
        })
    }
}