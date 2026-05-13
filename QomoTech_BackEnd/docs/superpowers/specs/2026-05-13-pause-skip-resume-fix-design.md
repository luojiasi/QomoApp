# 暂停/跳过/恢复控制流程修复设计

## 问题

`runner.py` 的暂停、跳过、恢复三个控制指令无法有效控制程序执行流程：

- **暂停** — `_修面和切片` 主循环未检查 `_是否已暂停`，仅 `MotionPrimitives` 的轴空闲轮询中间接生效。连续插补期间完全无法响应。
- **跳过** — 仅在 while 循环顶部检查。`连续插补XY(wait_until_done=True)` 阻塞期间无法响应，必须等当前轮廓切完。
- **恢复** — 暂停使用 `急停()` 触发 `_中止事件`，清空 MERGE 缓存。恢复后断点丢失，导致重切。

## 目标行为

| 指令 | 期望 |
|------|------|
| 暂停 | 立刻停（FEED_OVERRIDE=0），关激光。恢复后从停点继续，零重切 |
| 跳过 | 立刻停（_中止事件），Z 归位，继续下一个 entity |
| 恢复 | FEED_OVERRIDE=100，开激光，从断点继续 |

## 设计

### 1. 删除 `wait_until_done` 参数全链路

**原因**：`wait_until_done=True` 在 adapter 内部做 done-waiting 轮询，runner 无法介入。删掉后推完路径点即返回，runner 通过后续步骤已有的 `安全拉取xy是否空闲` / `安全拉取是否空闲` 轮询完成。

**范围**：

```
zmc_adapter._同步_连续插补()
  ├─ 删除 wait_until_done / done_timeout_s / done_poll_interval_s 参数
  └─ 删除阶段四 done-waiting while 循环

zmc_adapter.连续插补XY() / 连续插补运动()
  └─ 删除对应参数及透传

MotionService.连续插补XY() / 连续插补运动()
  └─ 删除对应参数及透传

motion_http.py
  └─ 删除 wait_until_done 实参，路由层不补轮询（前端有 WS 推送）

runner.py（2 处）
  └─ 删除 wait_until_done=True 实参
```

### 2. `暂停()` 改用软暂停（FEED_OVERRIDE=0）

```python
async def 暂停(self):
    self._是否已暂停 = True
    if 已连接:
        self._需恢复激光 = 激光之前开启
        if 激光之前开启: 关激光
        await self._运动.暂停()       # FEED_OVERRIDE=0，MERGE 缓存保留
```

### 3. `恢复()` 改用恢复（FEED_OVERRIDE=100）

```python
async def 恢复(self):
    self._是否已暂停 = False
    if 已连接:
        await self._运动.继续()        # FEED_OVERRIDE=100
        if self._需恢复激光: 开激光
```

### 4. `跳过()` 保持不变

仍用 `急停()` 触发 `_中止事件`，打断插补后 `跳过任务并回Z轴()`。

### 5. `_R轴切圆` / `_4P切产品` 适配

- `_R轴切圆` — 内层轮询已有完整检查，仅受益于软暂停
- `_4P切产品` — 删 `wait_until_done=True` 实参即可

## 影响范围

| 文件 | 改动类型 |
|------|----------|
| `zmc_adapter.py` | 删阶段四 + 参数 |
| `MotionService.py` | 删参数透传 |
| `motion_http.py` | 删实参 |
| `runner.py` | 删实参 + 暂停/恢复改用 MotionService 软暂停 |

净删代码为主，不引入新概念。

## 不变的部分

- `跳过()` 实现不变（急停 + Z 归位）
- `MotionPrimitives` 不变（已有暂停/跳过检查）
- `_修面和切片` / `_R轴切圆` / `_4P切产品` while 循环结构不变
- HTTP API 行为不变（前端有运动 WS 推状态，不需要路由层轮询）
- WebSocket 广播不变
