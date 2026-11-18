import { describe, expect, it } from "vitest";
import { findSites } from "./patterns.js";
import type { DynamicFamily } from "./strip.js";

const constructs = (source: string, family: DynamicFamily) => findSites(source, family).map((site) => site.construct);

describe("findSites: computed targets count, literal targets do not", () => {
  it.each<[DynamicFamily, string, string[]]>([
    // Python
    ["python", "getattr(self, 'item_' + name)()", ["getattr by name"]],
    ["python", "setattr(user, key, value)", ["getattr by name"]],
    ["python", "getattr(obj, f'x_{k}')", ["getattr by name"]],
    ["python", "getattr(obj, 'name', None); getattr(obj, \"other\")", []],
    ["python", "getattr(make(a, b), name)", ["getattr by name"]],
    ["python", "def __getattr__(self, name):\n    pass", ["__getattr__"]],
    ["python", "eval(expr); exec(code); x.eval(y)", ["eval or exec", "eval or exec"]],
    ["python", "exec code in ns", ["eval or exec"]],
    ["python", "__import__(name, globals(), {}); importlib.import_module(mod)", ["import by name", "import by name"]],
    ["python", "__import__('os'); import_module('json')", []],
    ["python", "globals()['X' + name]; globals()['plain']", ["globals() by name"]],
    ["python", "# getattr(a, b)\ns = 'eval(x)'", []],
    // PHP
    ["php", "<?php call_user_func($func); call_user_func_array($cb, $args);", ["call_user_func by name", "call_user_func by name"]],
    ["php", "<?php call_user_func('strlen', $x); call_user_func_array(array($this->user, 'lang'), $a); call_user_func([$o, 'm']);", []],
    ["php", "<?php $guesser->$is_supported(); Foo::$method();", ["variable method", "variable method"]],
    ["php", "<?php $fgetd($fp); $db = new $sql_db();", ["variable function", "new $class"]],
    ["php", "<?php echo ${$key}; $$name = 1;", ["variable variable", "variable variable"]],
    ["php", "<?php public function __call($m, $a) {} function __get($n) {} function __set($n, $v) {}", ["__call or __get", "__call or __get"]],
    ["php", "<?php eval($code); $q = \"INSERT INTO $table ($id) VALUES ($v)\";", ["eval"]],
    ["php", "<?php function f($a) { return isset($a) && strlen($a); }", []],
    // Ruby
    ["ruby", "uri.send(component); x.public_send name; y.__send__(:\"a_#{b}\")", ["send by name", "send by name", "send by name"]],
    ["ruby", "x.send(:save); x.send :update, a; x.public_send(\"plain\"); x.sender(y)", []],
    ["ruby", "def method_missing(sym, *args)\nend", ["method_missing"]],
    ["ruby", "define_method(name) { }; define_method hook do |c| end", ["define_method by name", "define_method by name"]],
    ["ruby", "define_method(:save) { }; define_method :load do end", []],
    ["ruby", "class_eval src, __FILE__; eval(code); class_eval do end; instance_eval { x }", ["eval of a string", "eval of a string"]],
    ["ruby", "params[:type].constantize; Object.const_get(params[:t]); 'Issue'.constantize; const_get(:Foo)", ["constantize by name", "constantize by name"]],
    ["ruby", "instance_variable_set('@' + n, o); instance_variable_get(:@name)", ["instance_variable by name"]],
    // Java
    ["java", "Class c = Class.forName(className); ClassLoaderUtil.loadClass(impl, getClass());", ["Class.forName by name", "Class.forName by name"]],
    ["java", "Class.forName(\"com.x.Y\"); cl.loadClass(\"a.B\");", []],
    ["java", "Method m = type.getMethod(name); Field f = type.getDeclaredField(prop);", ["getMethod by name", "getMethod by name"]],
    ["java", "request.getMethod(); type.getMethod(\"run\");", []],
    ["java", "field.setAccessible(true); Proxy.newProxyInstance(l, i, h);", ["setAccessible", "Proxy"]],
    // Found in the Struts calibration: a named constant, a method declaration, and a call to the class's own method.
    ["java", "Class.forName(VFS_JBOSS5); Class.forName(Names.VFS_JBOSS5);", []],
    ["java", "public static Class loadClass(String className, Class caller) { return loadClass(className); }", ["Class.forName by name"]],
    ["python", "getattr(module, DEFAULT_NAME)", []],
    // JavaScript and TypeScript
    ["javascript", "eval(code); new Function('a', body); obj.eval(x)", ["eval or Function", "eval or Function"]],
    ["javascript", "history[fn](obj); callbacks[i](); this[b.type](i);", ["computed call", "computed call", "computed call"]],
    ["javascript", "obj['save'](); list[0](); [a, b].forEach(f); x = arr[i];", []],
    ["javascript", "Reflect.apply(f, t, a); Reflect.construct(C, a);", ["Reflect", "Reflect"]],
    // C#
    ["csharp", "var t = Type.GetType(typeName); var a = Assembly.LoadFrom(path); asm.GetType(name);", ["GetType by name", "GetType by name", "GetType by name"]],
    ["csharp", "Type.GetType(\"My.Type\"); obj.GetType(); Assembly.Load(\"Core\");", []],
    ["csharp", "Activator.CreateInstance(type); Activator.CreateInstance(typeof(Foo)); Activator.CreateInstance<Foo>();", ["Activator.CreateInstance"]],
    ["csharp", "t.GetMethod(name); t.GetProperty(prop); t.InvokeMember(member, flags, null, o, args);", ["GetMethod by name", "GetMethod by name", "GetMethod by name"]],
    ["csharp", "t.GetMethod(\"Run\"); t.GetProperty(nameof(Item.Price)); t.GetField(FIELD_NAME);", []],
    ["csharp", "dynamic expando = new ExpandoObject(); void F(dynamic arg) {} var dynamicValue = 1;", ["dynamic", "dynamic"]],
    ["csharp", "// Type.GetType(x)\nvar s = @\"Activator.CreateInstance(t)\"; var r = \"\"\"t.GetMethod(n)\"\"\";", []],
    ["csharp", "var v = @\"C:\\dir\\\"; Type.GetType(n);", ["GetType by name"]],
    ["csharp", "var i = $\"{Type.GetType(n)}\"; var c = '\"'; t.GetMethod(m);", ["GetMethod by name"]],
    // Go
    ["go", "import \"reflect\"\nfunc f() { v := reflect.ValueOf(o); v.MethodByName(name).Call(args) }", ["MethodByName", "reflect Call"]],
    ["go", "v.MethodByName(\"Run\"); v.FieldByName(\"ID\"); client.Call(\"Svc.M\", a, r)", []],
    ["go", "p, _ := plugin.Open(path); sym, _ := p.Lookup(symbolName); m.Lookup(key)", ["plugin.Lookup", "plugin.Lookup"]],
    ["go", "p, _ := plugin.Open(path); p.Lookup(\"Handler\")", []],
    ["go", "env.Lookup(name) // no plugin package", []],
    ["go", "s := `v.MethodByName(name)` // reflect.Call\nx := 'r'", []],
    // C and C++
    ["c", "void *f = dlsym(handle, symbol); FARPROC p = GetProcAddress(mod, name);", ["symbol lookup by name", "symbol lookup by name"]],
    ["c", "dlsym(handle, \"plugin_init\"); GetProcAddress(mod, \"Run\"); dlsym(RTLD_DEFAULT, SYMBOL_NAME);", []],
    ["c", "handlers[op](ctx); currentMenu->menuitems[itemOn].routine(itemOn); (*table[i])(x); rc = (*wipes[wipeno*3+1])(w, h, t);", ["function-pointer table call", "function-pointer table call", "function-pointer table call", "function-pointer table call"]],
    ["c", "ops[OP_READ](ctx); fns[0](x); x = values[i]; fp(x); (*fp)(x); obj.method(y); (*table[0])(x); if (a[i]) (void)b;", []],
    ["c", "static int (*wipes[])(int, int, int) = { a, b }; actor->state->action.acp1(actor);", []],
    ["c", "auto f = [&](int a) { return a; }; v[i][j](k); T& operator[](size_t i);", ["function-pointer table call"]],
    ["c", "// handlers[op](x)\nconst char *s = \"t[i](x)\"; char c = '['; auto r = R\"x(t[i](y))x\";", []],
  ])("%s: %s", (family, source, expected) => {
    expect(constructs(source, family)).toEqual(expected);
  });
});

describe("findSites: Java Method.invoke", () => {
  it("counts invoke with arguments only in files importing java.lang.reflect", () => {
    const reflective = "import java.lang.reflect.Method;\nclass A { void f() { method.invoke(target, args); invocation.invoke(); this.invoke(root, smd); } }";
    expect(findSites(reflective, "java")).toEqual([{ line: 2, construct: "Method.invoke" }]);
    expect(findSites("import java.lang.reflect.*;\nm.invoke(o);", "java")).toEqual([{ line: 2, construct: "Method.invoke" }]);
    expect(findSites("class A { void f() { handler.invoke(x); } }", "java")).toEqual([]);
  });
});

describe("findSites: C# MethodInfo.Invoke", () => {
  it("counts Invoke with arguments only in files using System.Reflection, and never ?.Invoke on events", () => {
    const reflective = "using System.Reflection;\nclass A { void F() { method.Invoke(target, args); Changed?.Invoke(this, e); action.Invoke(); } }";
    expect(findSites(reflective, "csharp")).toEqual([{ line: 2, construct: "MethodInfo.Invoke" }]);
    expect(findSites("class A { void F() { handler.Invoke(x); } }", "csharp")).toEqual([]);
  });
});

describe("findSites: lines", () => {
  it("reports the line of each site in the original text, after multi-line strings", () => {
    const source = 's = """\nmany\nlines\n"""\nx = getattr(o, n)\n';
    expect(findSites(source, "python")).toEqual([{ line: 5, construct: "getattr by name" }]);
  });
});
