## QomoTech_FrontEnd view 目录说明

该目录用于放置页面级视图（路由页面）。

### 文件功能

- `Login.vue`：登录页，先检查离线授权状态，再执行账号密码登录并跳转首页。
- `Home.vue`：固定首页，不显示滚动条，主要用于统一展示各功能页面入口。
- `License.vue`：离线授权页，显示设备指纹、授权状态，输入密钥进行激活。
- `Help.vue`：帮助界面，承接原 Home 页的授权信息、账号设置和管理员密钥维护内容。
- `ControllerSettings.vue`：控制器参数设置页，预留 ZMC406-V2 通讯、轴参数、安全 I/O 和组件占位区。
- 参数设置相关页面已从前端移除。
- `RecipeManagement.vue`：配方管理页，预留配方列表、详情、版本发布和组件占位区。
- `DetailedRs232Send.vue`：详细 RS232 数据发送区，串口参数与发送帧编辑界面。
- `ReserveWorkbenchC.vue`：备用界面 C，预留系统工具与日志审计相关组件位置。
- `A.md`：本目录用途和文件作用说明文档。

---