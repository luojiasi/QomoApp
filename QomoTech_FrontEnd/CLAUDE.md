# CLAUDE.md — QomoTech FrontEnd 开发规范

## 类型检查

**必须使用以下命令验证，禁止用裸 `tsc`：**

```bash
npx vue-tsc --noEmit -p tsconfig.web.json
```

裸 `tsc` 无法正确检查 `.vue` SFC 模板类型，打包流程实际用的是 `vue-tsc -p tsconfig.web.json`，曾多次因此漏检错误。

**要求**：每次修改 `.vue` / `.ts` 文件后，运行上述命令确认 **0 error** 再交付。

## 修改接口后必须回溯所有实现点

改了 interface / type 之后，不要只修核心调用处。必须：

- `grep` 搜索接口字段名，找到所有构造该类型的对象字面量
- 搜索所有实现该 `Record<Type, any>` 的变量（如 `GROUP_LABELS`）
- 更新 form 初始化、`reset()`、`reload()`、`toData()` 等所有相关函数

曾因 `ActionGroup` 新增 `'freeparam'` 漏了 `ShortcutEditor.vue` 的 `GROUP_LABELS`，因 `Canvas2DConfig` 新增 `freeparamStroke` 漏了 `useCanvas2DSettings.ts` 的 5 处实现。

## 修改后验证清单

1. `npx vue-tsc --noEmit -p tsconfig.web.json` → 0 error
2. `npx eslint --cache .` → 0 error 0 warning（至少检查改动的文件）
3. 改了接口：grep 全项目确认所有实现处已更新
