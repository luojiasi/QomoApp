# 暂停/跳过/恢复控制流程修复

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 `wait_until_done` 参数全链路，暂停/恢复改用 FEED_OVERRIDE 软暂停，使暂停后可从断点零重切继续。

**Architecture:** 删除 adapter 层 done-waiting 循环，推完路径点即返回。runner 通过已有 `安全拉取xy是否空闲` 轮询完成。暂停用 `MotionService.暂停()` (FEED_OVERRIDE=0) 替代急停，MERGE 缓存保留。

**Tech Stack:** Python 3.13, FastAPI, ZMC motion controller DLL

---

### Task 1: 删除 `_同步_连续插补` 的 done-waiting 阶段和参数

**Files:**
- Modify: `services/motion_control/zmc_adapter.py`

- [ ] **Step 1: 删除阶段四 done-waiting 循环**

删除 lines 1830-1868（`if not kw["wait_until_done"]: return` 及整个阶段四 while 循环）：

```python
# 删除前 (lines 1830-1868):
            if not kw["wait_until_done"]:
                return

            # ---- 阶段四: 等待完成,每轮短锁 + 响应中止事件 ----
            起始 = time.time()
            while True:
                if not self._已连接:
                    raise ZMCError("ContinuousInterp", -1, "控制器在插补中断开")
                # ⭐ 中止事件优先检查
                if self._中止事件.is_set():
                    被中止 = True
                    return
                # 短锁: 读 MovesBuffered + 各轴 IDLE
                with self._锁:
                    ret_mb, mb_val = self._dll.ZAux_Direct_GetMovesBuffered(主轴)
                    if int(ret_mb) == 0:
                        缓冲已清空 = int(mb_val.value) == 0
                    else:
                        ret_buf, 剩余_val = self._dll.ZAux_Direct_GetRemain_LineBuffer(主轴)
                        剩余 = int(剩余_val.value) if int(ret_buf) == 0 else 0
                        缓冲已清空 = 剩余 >= 4090
                    全部空闲 = True
                    for 轴号 in 轴号列表:
                        ret_idle, idle_val = self._dll.ZAux_Direct_GetIfIdle(轴号)
                        if int(ret_idle) != 0:
                            continue
                        if int(idle_val.value) == -1:
                            continue
                        全部空闲 = False
                        break
                if 缓冲已清空 and 全部空闲:
                    return
                if time.time() - 起始 > float(kw["done_timeout_s"]):
                    raise ZMCError("ContinuousInterp", -1, "等待完成超时")
                if self._中止事件.wait(done_sleep_s):
                    被中止 = True
                    return
```

删除后阶段三末尾直接接 finally：

```python
            if 被中止:
                return
        finally:
```

- [ ] **Step 2: 删除 `done_sleep_s` 局部变量**

删除 line 1798:
```python
        done_sleep_s = max(float(kw["done_poll_interval_s"]), 0.005)
```

- [ ] **Step 3: 删除 `连续插补运动` 的 done-waiting 参数**

修改 lines 1634-1636，删除：
```python
        wait_until_done: bool = True,
        done_timeout_s: float = 120.0,
        done_poll_interval_s: float = 0.005,
```

修改 lines 1674-1676，删除透传：
```python
            wait_until_done=wait_until_done,
            done_timeout_s=done_timeout_s,
            done_poll_interval_s=done_poll_interval_s,
```

- [ ] **Step 4: 删除 `连续插补XY` adapter 方法的 done-waiting 参数**

修改 lines 1954-1956，删除：
```python
        wait_until_done: bool = True,
        done_timeout_s: float = 120.0,
        done_poll_interval_s: float = 0.005,
```

修改 lines 2012-2014，删除透传：
```python
            wait_until_done=wait_until_done,
            done_timeout_s=done_timeout_s,
            done_poll_interval_s=done_poll_interval_s,
```

- [ ] **Step 5: 验证**

```powershell
cd "D:\Qomo\QomoTech\QomoTech_BackEnd" ; python -c "from services.motion_control.zmc_adapter import ZMC适配器; print('OK')"
```

- [ ] **Step 6: Commit**

```bash
git add services/motion_control/zmc_adapter.py
git commit -m "refactor: delete wait_until_done parameter and done-waiting loop from zmc_adapter"
```

---

### Task 2: 删除 MotionService `连续插补XY` 和 `连续插补运动` 的 done-waiting 参数

**Files:**
- Modify: `services/MotionService.py`

- [ ] **Step 1: 删除 `连续插补XY` 参数**

修改 lines 1068-1070，删除：
```python
        wait_until_done: bool = True,
        done_timeout_s: float = 120.0,
        done_poll_interval_s: float = 0.02,
```

修改 lines 1085-1087，删除透传：
```python
                wait_until_done=wait_until_done,
                done_timeout_s=done_timeout_s,
                done_poll_interval_s=done_poll_interval_s,
```

- [ ] **Step 2: `连续插补运动` 使用 `**kwargs` 透传，无需改签名**

`连续插补运动` 用 `**kwargs: Any` 透传，adapter 删了 `wait_until_done` 参数后，HTTP 路由不再传这些 key 即可。无需改 MotionService 签名。

- [ ] **Step 3: 验证**

```powershell
cd "D:\Qomo\QomoTech\QomoTech_BackEnd" ; python -c "from services.MotionService import MotionService; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add services/MotionService.py
git commit -m "refactor: delete wait_until_done from MotionService.连续插补XY"
```

---

### Task 3: 删除 `motion_http.py` 请求模型和路由中的 done-waiting 参数

**Files:**
- Modify: `routers/http/motion_http.py`

- [ ] **Step 1: 删除 `XY连续插补请求模型` 中的字段**

删除 lines 167-169:
```python
    wait_until_done: bool = Field(True)
    done_timeout_s: float = Field(120.0, gt=0)
    done_poll_interval_s: float = Field(0.02, gt=0)
```

- [ ] **Step 2: 删除 `ContourMultiRequest` 中的字段**

删除 lines 185-186:
```python
    wait_until_done: bool = Field(True)
    done_timeout_s: float = Field(120.0, gt=0)
```

- [ ] **Step 3: 删除路由 handler `连续插补XY` 中的透传**

删除 lines 538-540:
```python
            wait_until_done=req.wait_until_done,
            done_timeout_s=req.done_timeout_s,
            done_poll_interval_s=req.done_poll_interval_s,
```

- [ ] **Step 4: 删除路由 handler `连续插补运动` 中的透传**

删除 lines 558-559:
```python
        "wait_until_done": req.wait_until_done,
        "done_timeout_s": req.done_timeout_s,
```

- [ ] **Step 5: 验证**

```powershell
cd "D:\Qomo\QomoTech\QomoTech_BackEnd" ; python -c "from routers.http.motion_http import 路由; print('OK')"
```

- [ ] **Step 6: Commit**

```bash
git add routers/http/motion_http.py
git commit -m "refactor: delete wait_until_done from motion_http request models and routes"
```

---

### Task 4: 删除 runner.py 中的 `wait_until_done=True`

**Files:**
- Modify: `services/program_control/runner.py`

- [ ] **Step 1: 删除 `_修面和切片` 中的实参**

Line 468，将：
```python
await self._运动.连续插补XY(路径点=原始点数据_插补数据, 速度=目标运行速度, wait_until_done=True)
```
改为：
```python
await self._运动.连续插补XY(路径点=原始点数据_插补数据, 速度=目标运行速度)
```

- [ ] **Step 2: 删除 `_4P切产品` 中的实参**

Line 1067，将：
```python
await self._运动.连续插补XY(路径点=原始点数据_插补数据, 速度=目标速度, wait_until_done=True)
```
改为：
```python
await self._运动.连续插补XY(路径点=原始点数据_插补数据, 速度=目标速度)
```

- [ ] **Step 3: 验证**

```powershell
cd "D:\Qomo\QomoTech\QomoTech_BackEnd" ; python -c "from services.program_control.runner import ProgramRunner; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add services/program_control/runner.py
git commit -m "refactor: delete wait_until_done=True from runner"
```

---

### Task 5: `暂停()` 改用软暂停，`恢复()` 改用软恢复

**Files:**
- Modify: `services/program_control/runner.py`

- [ ] **Step 1: 修改 `暂停()` — `self._运动.急停()` → `self._运动.暂停()`**

Line 135，将：
```python
            await self._运动.急停()
```
改为：
```python
            await self._运动.暂停()
```

- [ ] **Step 2: 修改 `恢复()` — 加 `self._运动.继续()` 调用**

Lines 144-146，将：
```python
        if self._运动.适配器 and self._运动.适配器.已连接 and self._需恢复激光:
            await self._运动.设置输出(2, True)
            self._需恢复激光 = False
```
改为：
```python
        if self._运动.适配器 and self._运动.适配器.已连接:
            await self._运动.继续()
            if self._需恢复激光:
                await self._运动.设置输出(2, True)
                self._需恢复激光 = False
```

- [ ] **Step 3: 验证**

```powershell
cd "D:\Qomo\QomoTech\QomoTech_BackEnd" ; python -c "from services.program_control.runner import ProgramRunner; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add services/program_control/runner.py
git commit -m "fix: use FEED_OVERRIDE soft pause instead of estop for pause/resume"
```

---

### Task 6: 全量验证

- [ ] **Step 1: 验证所有模块导入**

```powershell
cd "D:\Qomo\QomoTech\QomoTech_BackEnd" ; python -c "from core.app import app; print('App OK')"
```

- [ ] **Step 2: 验证 `wait_until_done` 已全部清除**

```powershell
cd "D:\Qomo\QomoTech\QomoTech_BackEnd" ; python -c "import subprocess; subprocess.run(['rg', 'wait_until_done', '--type', 'py', 'services/', 'routers/'])"
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: final verification after pause/skip/resume fix"
```
