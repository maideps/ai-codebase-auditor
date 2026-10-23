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

describe("findSites: lines", () => {
  it("reports the line of each site in the original text, after multi-line strings", () => {
    const source = 's = """\nmany\nlines\n"""\nx = getattr(o, n)\n';
    expect(findSites(source, "python")).toEqual([{ line: 5, construct: "getattr by name" }]);
  });
});
