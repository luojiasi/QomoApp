# Git 操作与使用方法全览

---

## 一、基础配置

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
git config --list                          # 查看所有配置
git config --global core.editor "code --wait"  # 设置编辑器
```

---

## 二、仓库操作

```bash
git init                    # 初始化新仓库
git clone <url>             # 克隆远程仓库
git clone -b <branch> <url> # 克隆指定分支
git remote -v               # 查看远程仓库
git remote add <name> <url> # 添加远程仓库
```

---

## 三、状态与日志

```bash
git status                  # 查看工作区状态
git log                     # 查看提交历史
git log --oneline --graph   # 简洁图形化历史
git log -p                  # 查看每次提交的差异
git reflog                  # 查看所有 HEAD 移动记录（救命用）
git diff                    # 查看未暂存的改动
git diff --staged           # 查看已暂存的改动
git blame <file>            # 查看每行代码是谁改的
```

---

## 四、暂存与提交

```bash
git add <file>              # 暂存指定文件
git add .                   # 暂存所有改动
git add -p                  # 交互式选择暂存哪些改动
git commit -m "message"     # 提交
git commit --amend          # 修改最近一次提交
git reset HEAD <file>       # 取消暂存
git checkout -- <file>      # 放弃工作区改动
```

---

## 五、分支操作

```bash
git branch                  # 列出本地分支
git branch -a               # 列出所有分支（含远程）
git branch <name>           # 创建分支
git checkout <branch>       # 切换分支
git checkout -b <branch>    # 创建并切换分支
git switch <branch>         # 新式切换分支
git switch -c <branch>      # 新式创建并切换
git merge <branch>          # 合并指定分支到当前分支
git rebase <branch>         # 变基到指定分支
git branch -d <branch>      # 删除分支
git branch -D <branch>      # 强制删除分支
git cherry-pick <commit>    # 摘取某个提交到当前分支
git stash                   # 暂存当前改动
git stash pop               # 恢复暂存的改动
```

---

## 六、远程操作

```bash
git fetch                   # 拉取远程更新（不合并）
git pull                    # 拉取并合并（= fetch + merge）
git pull --rebase           # 拉取并变基
git push                    # 推送到远程
git push -u origin <branch> # 首次推送并建立追踪
git push --force-with-lease # 安全强制推送
git remote prune origin     # 清理已删除的远程分支引用
```

---

## 七、撤销与回退

```bash
git reset --soft HEAD~1     # 撤销提交，保留改动在暂存区
git reset --mixed HEAD~1    # 撤销提交和暂存，保留在工作区（默认）
git reset --hard HEAD~1     # 彻底回退，丢弃所有改动
git revert <commit>         # 创建一个新提交来撤销指定提交（安全）
git revert --no-commit <commit>  # 撤销但不自动提交
```

---

## 八、合并冲突处理

```bash
git merge --abort           # 放弃合并
git mergetool               # 使用可视化工具解决冲突
git diff --name-only --diff-filter=U  # 查看冲突文件列表
```

---

## 九、高级操作

```bash
git rebase -i HEAD~3        # 交互式变基（合并/编辑/删除最近3个提交）
git bisect start            # 二分查找定位 bug 引入的提交
git submodule update --init # 初始化并更新子模块
git worktree add <path> <branch>  # 创建并行工作目录
git archive -o output.zip HEAD    # 导出代码快照
git tag v1.0.0              # 创建标签
git tag -a v1.0.0 -m "..."  # 创建附注标签
git push --tags             # 推送所有标签
```

---

## 十、实用技巧

```bash
git log --author="name"          # 按作者过滤提交
git log --since="2026-01-01"     # 按时间过滤
git log -S "keyword"             # 搜索引入/删除某关键词的提交
git shortlog -sn                 # 统计每个人的提交数
git stash list                   # 查看所有 stash
git clean -n                     # 预览将被删除的未追踪文件
git clean -f                     # 删除未追踪文件
```

---

# 场景实战详解

---

## 场景一：新人入职 —— 从零搭建环境

### 1.1 安装 Git 后首次配置

```bash
# 设置身份（提交时显示的名字和邮箱）
git config --global user.name "张三"
git config --global user.email "zhangsan@company.com"

# 设置默认分支名为 main（Git 2.28+ 支持）
git config --global init.defaultBranch main

# 设置换行符策略（Windows 推荐）
git config --global core.autocrlf true

# macOS/Linux 推荐
git config --global core.autocrlf input

# 设置常用别名，提高效率
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.lg "log --oneline --graph --all"
git config --global alias.unstage "reset HEAD --"
git config --global alias.last "log -1 HEAD"

# 查看当前所有配置
git config --list
```

### 1.2 生成 SSH Key 并添加到 GitHub/GitLab

```bash
# 生成 SSH 密钥（一路回车即可）
ssh-keygen -t ed25519 -C "zhangsan@company.com"

# 如果系统不支持 ed25519，用 RSA
ssh-keygen -t rsa -b 4096 -C "zhangsan@company.com"

# 查看公钥内容，复制到 GitHub/GitLab 的 Settings → SSH Keys
cat ~/.ssh/id_ed25519.pub    # Linux/macOS
type %userprofile%\.ssh\id_ed25519.pub   # Windows PowerShell

# 测试连接
ssh -T git@github.com        # GitHub
ssh -T git@gitlab.com        # GitLab
```

### 1.3 克隆公司项目

```bash
# SSH 方式（推荐，配好 SSH Key 后无需输密码）
git clone git@github.com:company/project.git

# HTTPS 方式（需要输入用户名密码/token）
git clone https://github.com/company/project.git

# 克隆指定分支
git clone -b develop git@github.com:company/project.git

# 克隆后进入项目目录
cd project

# 查看远程仓库信息
git remote -v
```

---

## 场景二：日常开发流程（单人）

### 2.1 开始一天的工作

```bash
# 1. 切换到开发分支
git checkout develop

# 2. 拉取最新代码
git pull

# 3. 从 develop 创建功能分支
git checkout -b feature/user-login

# 现在可以开始写代码了
```

### 2.2 写代码过程中的操作

```bash
# 查看当前状态（最常用命令，没有之一）
git status

# 查看具体改了什么
git diff                    # 查看未暂存的改动
git diff src/login.js       # 只查看某个文件的改动

# 暂存改动（准备提交）
git add src/login.js        # 只添加一个文件
git add src/                # 添加整个目录
git add .                   # 添加所有改动
git add -p                  # 逐块选择要暂存的改动（非常实用）

# 如果加错了，取消暂存
git reset HEAD src/login.js

# 如果改错了文件，想恢复到修改前的状态
git checkout -- src/login.js   # 危险操作，工作区改动会丢失
```

### 2.3 提交代码

```bash
# 提交到本地仓库
git commit -m "feat: 添加用户登录功能"

# 常用的提交信息规范（Conventional Commits）：
# feat:     新功能
# fix:      修复 bug
# refactor: 重构（不改变功能）
# docs:     文档
# style:    代码格式（不影响逻辑）
# test:     测试相关
# chore:    杂项（构建、依赖等）

# 如果提交后发现漏了文件，补充到上次提交
git add forgotten-file.js
git commit --amend         # 会打开编辑器让你修改提交信息
git commit --amend --no-edit  # 保留原提交信息，只补充文件

# 如果提交信息写错了
git commit --amend -m "feat: 添加用户登录及 token 持久化"

# 查看提交历史
git log --oneline           # 简洁模式
git log --oneline --graph   # 图形化
git log -3                  # 只看最近 3 条
```

### 2.4 暂存现场（stash）—— 写一半要切分支

```bash
# 正在写功能，突然要切去修 bug
git stash                   # 暂存所有改动，工作区恢复干净
# 或者加上描述信息
git stash save "用户登录功能进行到一半"

# 切去修 bug...
git checkout main
# ... 修完 bug 提交后回来
git checkout feature/user-login

# 恢复之前的进度
git stash pop               # 恢复最近一次 stash 并删除记录
git stash apply              # 恢复但不删除 stash 记录

# 查看 stash 列表
git stash list
# 输出示例：stash@{0}: On feature/user-login: 用户登录功能进行到一半

# 恢复指定的 stash
git stash pop stash@{1}

# 删除某个 stash
git stash drop stash@{0}

# 清空所有 stash
git stash clear
```

---

## 场景三：分支协作流程（团队）

### 3.1 Git Flow 分支模型

```
main (生产)
  │
  ├── develop (开发主线)
  │     │
  │     ├── feature/A (功能分支)
  │     ├── feature/B
  │     │
  │     └── release/1.0 (发布分支)
  │
  └── hotfix/urgent-fix (紧急修复)
```

```bash
# === 功能开发流程 ===

# 1. 从 develop 创建功能分支
git checkout develop
git pull
git checkout -b feature/payment

# 2. 开发并提交
git add .
git commit -m "feat: 实现支付接口对接"

# 3. 推送功能分支到远程（方便备份和协作）
git push -u origin feature/payment

# 4. 开发完成，合并回 develop
git checkout develop
git pull                    # 先拉取最新
git merge feature/payment   # 合并功能分支

# 5. 如果有冲突，解决冲突后提交
# （冲突解决详见场景七）

# 6. 推送
git push

# 7. 删除功能分支
git branch -d feature/payment          # 删除本地
git push origin --delete feature/payment  # 删除远程
```

### 3.2 GitHub Flow（更简单的模型）

```
main
  │
  ├── feature-branch-1 → PR → 合并到 main
  ├── feature-branch-2 → PR → 合并到 main
  └── hotfix-branch    → PR → 合并到 main
```

```bash
# 1. 从 main 创建分支
git checkout main
git pull
git checkout -b my-feature

# 2. 开发和提交
git add .
git commit -m "feat: 新功能"

# 3. 推送
git push -u origin my-feature

# 4. 在 GitHub/GitLab 上创建 Pull Request（PR）
#    团队 review 通过后，在网页上点击 Merge

# 5. 本地同步
git checkout main
git pull
git branch -d my-feature
```

### 3.3 拉取远程分支并协作

```bash
# 查看所有远程分支
git branch -r

# 拉取同事创建的分支到本地
git fetch
git checkout -b feature/colleague-work origin/feature/colleague-work

# 或者用 switch（Git 2.23+）
git switch feature/colleague-work   # 自动追踪同名远程分支

# 同步同事的最新改动
git pull
```

---

## 场景四：提交历史管理

### 4.1 整理提交记录 —— 交互式变基（rebase -i）

```bash
# 整理最近 3 个提交（合并、修改、删除、调序）
git rebase -i HEAD~3

# 编辑器会打开，显示类似：
# pick a1b2c3d feat: 登录功能-第一部分
# pick e4f5g6h feat: 登录功能-第二部分
# pick i7j8k9l fix: 修复登录的一个小 bug

# 常用命令：
# pick   保留该提交
# reword 保留但修改提交信息
# squash 合并到上一个提交，保留提交信息（让你编辑）
# fixup  合并到上一个提交，丢弃提交信息
# drop   删除该提交
# edit   暂停，让你修改该提交的内容

# 示例：将三个提交合并为一个
# pick a1b2c3d feat: 登录功能-第一部分
# squash e4f5g6h feat: 登录功能-第二部分
# squash i7j8k9l fix: 修复登录的一个小 bug
# 保存后，会让你编辑合并后的提交信息
```

### 4.2 修改任意历史提交

```bash
# 用 rebase -i 的 edit 命令
git rebase -i HEAD~5

# 把要修改的那个 commit 的 pick 改成 edit，保存
# Git 会停在该 commit 处

# 现在可以修改文件
git add .
git commit --amend

# 继续 rebase
git rebase --continue

# 如果想放弃整个 rebase
git rebase --abort
```

### 4.3 拆分一个提交为多个

```bash
# 1. 开始交互式变基，把要拆分的 commit 标记为 edit
git rebase -i HEAD~3

# 2. Git 停在目标 commit，撤销该提交但保留改动
git reset HEAD~1

# 3. 现在所有改动在工作区，分多次提交
git add part1.js
git commit -m "feat: 第一部分"

git add part2.js
git commit -m "feat: 第二部分"

# 4. 继续 rebase
git rebase --continue
```

### 4.4 把一个提交从一个分支移到另一个分支（cherry-pick）

```bash
# 场景：在错误的分支上做了提交，想搬过去

# 1. 记下那个提交的 hash
git log --oneline
# 输出：a1b2c3d feat: 某个功能

# 2. 切换到正确的分支
git checkout correct-branch

# 3. 摘取那个提交
git cherry-pick a1b2c3d

# 4. 回到错误分支，删除那个提交
git checkout wrong-branch
git reset --hard HEAD~1     # 或 git rebase -i 删除

# 一次摘取多个提交
git cherry-pick a1b2 c3d4 e5f6

# 摘取一段连续提交（不含 A）
git cherry-pick A..B         # 摘取 A 之后到 B 的所有提交

# 摘取一段连续提交（含 A）
git cherry-pick A^..B
```

---

## 场景五：撤销与回退（救火指南）

### 5.1 工作区的撤销

```bash
# 改坏了文件，想恢复到修改前（未暂存）
git checkout -- filename.js
# 或新版写法
git restore filename.js

# 恢复所有文件
git restore .
```

### 5.2 暂存区的撤销

```bash
# 已经 git add 了，想取消暂存
git reset HEAD filename.js
# 新版写法
git restore --staged filename.js
```

### 5.3 提交的撤销

```bash
# 撤销最近一次提交，改动回到暂存区（最常用）
git reset --soft HEAD~1

# 撤销最近一次提交，改动回到工作区
git reset --mixed HEAD~1   # 或 git reset HEAD~1

# 撤销最近一次提交，改动全部丢弃（危险！）
git reset --hard HEAD~1

# 撤销最近 N 次提交
git reset --soft HEAD~3

# 撤销到指定 commit（保留改动）
git reset --soft a1b2c3d

# 撤销到指定 commit（丢弃改动，危险！）
git reset --hard a1b2c3d
```

### 5.4 安全的撤销 —— revert（已推送的提交必须用这个）

```bash
# revert 不会删除历史，而是创建一个新提交来"反向操作"
git revert a1b2c3d

# 会弹出编辑器让你确认提交信息，保存即可

# 撤销最近一次提交
git revert HEAD

# 撤销但不自动提交（可以合并多个 revert 为一次提交）
git revert --no-commit a1b2c3d
git revert --no-commit e4f5g6h
git commit -m "revert: 回退支付模块的两个提交"
```

### 5.5 用 reflog 找回"丢失"的提交（救命稻草）

```bash
# 场景：git reset --hard 之后发现删错了，想找回来

# 1. 查看 reflog，找到之前的 commit hash
git reflog
# 输出：
# a1b2c3d HEAD@{0}: reset: moving to HEAD~3
# e4f5g6h HEAD@{1}: commit: 重要的功能

# 2. 恢复到那个 commit
git reset --hard e4f5g6h
# 或者创建一个新分支指向它
git checkout -b recovered-branch e4f5g6h
```

### 5.6 修改最后一次提交

```bash
# 漏了文件
git add forgotten-file.js
git commit --amend --no-edit

# 提交信息写错了
git commit --amend -m "correct message"

# 想移除某个文件（不改变提交信息）
git rm --cached unwanted-file.js
git commit --amend --no-edit
```

---

## 场景六：Merge vs Rebase 的区别与选择

### 6.1 Merge（合并）

```bash
# 在 main 分支上合并 feature 分支
git checkout main
git merge feature/login

# 结果：创建一个新的"合并提交"，保留两条分支的完整历史
# main:     A---B---C---M (merge commit)
#                \     /
# feature:        D---E
```

**优点：** 保留完整历史，不改变已有提交，适合公共分支
**缺点：** 分支多时历史图复杂

### 6.2 Rebase（变基）

```bash
# 在 feature 分支上变基到 main
git checkout feature/login
git rebase main

# 结果：feature 的提交被"搬"到 main 的最新 commit 之后，历史是线性的
# main:     A---B---C
#                      \
# feature:               D'---E'  (commit hash 变了)
```

**优点：** 历史干净线性，没有多余的合并提交
**缺点：** 改变了提交 hash，如果分支已被推送，需要 force push

### 6.3 黄金法则与选择策略

```
┌─────────────────────────────────────────────────┐
│  分支类型          │  推荐操作     │  原因       │
├─────────────────────────────────────────────────┤
│  私有功能分支      │  rebase       │  历史干净   │
│  已推送的分支      │  merge        │  不改历史   │
│  公共分支(main)    │  merge        │  绝不 rebase│
│  同步上游改动      │  rebase       │  避免分叉   │
│  保持 PR 干净      │  rebase       │  线性历史   │
└─────────────────────────────────────────────────┘
```

```bash
# 推荐的日常流程：用 rebase 保持功能分支同步
git checkout feature/my-work
git fetch
git rebase origin/main    # 把 feature 的提交搬到最新 main 之上

# 如果 rebase 过程中有冲突
# 1. 解决冲突文件
# 2. git add .
# 3. git rebase --continue
# 4. 如果想放弃：git rebase --abort

# rebase 完成后，推送（注意需要 force）
git push --force-with-lease origin feature/my-work
```

---

## 场景七：合并冲突 —— 完整解决流程

### 7.1 冲突是如何产生的

```
分支 A 和分支 B 都修改了同一个文件的同一行，Git 无法自动判断用哪个版本。

main:     A---B---C
           \     \
feature:    D---E---?  ← 合并时冲突
```

### 7.2 合并时遇到冲突

```bash
git checkout main
git merge feature/login

# 输出：
# Auto-merging src/app.js
# CONFLICT (content): Merge conflict in src/app.js
# Automatic merge failed; fix conflicts and then commit the result.

# 查看冲突文件
git status
# 输出：both modified: src/app.js
```

### 7.3 冲突文件内容

```javascript
// 冲突文件中的标记：
<<<<<<< HEAD
// 这是 main 分支的版本
const API_URL = 'https://api.example.com/v1';
=======
// 这是 feature/login 分支的版本
const API_URL = 'https://api.example.com/v2';
>>>>>>> feature/login
```

### 7.4 手动解决冲突

```javascript
// 选择保留 v2 版本（或手动合并为正确版本）
const API_URL = 'https://api.example.com/v2';
// 删除 <<<<<<< ======= >>>>>>> 标记即可
```

### 7.5 使用工具解决

```bash
# VS Code 内置冲突解决器（推荐）
# 打开冲突文件，点击 "Accept Current" / "Accept Incoming" / "Accept Both"

# 命令行工具
git mergetool              # 打开配置的可视化合并工具

# 批量选择某一方的版本（不逐文件处理）
git checkout --theirs .     # 全部采用合并进来的分支的版本
git checkout --ours .        # 全部采用当前分支的版本
```

### 7.6 完成合并

```bash
# 解决完所有冲突后
git add .                   # 标记冲突已解决
git commit                  # 完成合并提交（会生成默认信息）
# 或
git merge --continue        # Git 2.22+ 的写法
```

### 7.7 放弃合并

```bash
# 冲突太复杂想重来
git merge --abort           # 回到合并前的干净状态
```

### 7.8 Rebase 过程中的冲突

```bash
git rebase main

# 遇到冲突后：
# 1. 解决冲突文件
# 2. git add .
# 3. git rebase --continue   ← 注意不是 commit

# 如果某个提交的改动完全没必要了
git rebase --skip           # 跳过当前这个提交

# 放弃整个 rebase
git rebase --abort
```

---

## 场景八：代码审查与 Pull Request

### 8.1 创建 PR 前的准备工作

```bash
# 1. 确保分支基于最新的 main/develop
git checkout main
git pull
git checkout feature/my-work
git rebase main            # 或 git merge main

# 2. 整理提交历史（把零散的 WIP 提交合并）
git rebase -i HEAD~5       # 把 fixup 类型的合并

# 3. 运行测试确保通过
npm test

# 4. 推送
git push --force-with-lease origin feature/my-work
```

### 8.2 PR Review 后需要修改

```bash
# 方式一：直接在原分支上修改（推荐）
# 修改文件后
git add .
git commit -m "fix: 根据 review 意见修改登录逻辑"
git push origin feature/my-work
# PR 会自动更新

# 方式二：把修改合并到已有提交中
git add .
git commit --amend --no-edit
git push --force-with-lease origin feature/my-work
```

### 8.3 PR 合并后清理本地

```bash
# PR 在网页上合并后
git checkout main
git pull                    # 拉取合并后的最新 main

# 删除本地功能分支
git branch -d feature/my-work

# 清理远程已删除的分支引用
git remote prune origin
```

---

## 场景九：标签与发布管理

### 9.1 创建标签

```bash
# 轻量标签（仅一个指针）
git tag v1.0.0

# 附注标签（包含作者、日期、信息，推荐用于发布）
git tag -a v1.0.0 -m "正式版 1.0.0 发布"

# 给历史提交打标签
git tag -a v0.9.0 a1b2c3d -m "测试版 0.9.0"

# 查看所有标签
git tag
git tag -l "v1.*"           # 按模式过滤

# 查看标签详情
git show v1.0.0
```

### 9.2 推送与删除标签

```bash
# 推送单个标签
git push origin v1.0.0

# 推送所有标签
git push --tags

# 删除本地标签
git tag -d v1.0.0

# 删除远程标签
git push origin --delete v1.0.0
# 或
git push origin :refs/tags/v1.0.0
```

### 9.3 基于标签创建分支（修复已发布版本的 bug）

```bash
# 场景：v1.0.0 发布了，但发现一个 bug 需要修复

# 1. 从标签创建分支
git checkout -b hotfix/v1.0.1 v1.0.0

# 2. 修复 bug 并提交
git add .
git commit -m "fix: 修复 v1.0.0 中的支付异常"

# 3. 打新标签
git tag -a v1.0.1 -m "修复支付异常"

# 4. 推送
git push origin hotfix/v1.0.1
git push origin v1.0.1

# 5. 如果这个 bug 在 main 上也存在，合并回去
git checkout main
git merge hotfix/v1.0.1
```

---

## 场景十：Git 工作目录管理（Worktree）

### 10.1 同时工作在多个分支

```bash
# 场景：正在 feature/A 上开发，突然需要修 main 上的 bug
# 不想 stash 也不想 commit 未完成的工作

# 1. 在 main 分支的另一个目录创建工作目录
git worktree add ../project-hotfix main

# 2. 在那边修 bug
cd ../project-hotfix
# 修改、提交、推送...

# 3. 完成后回来
cd ../project
# 功能分支的改动原封不动

# 查看所有工作目录
git worktree list

# 删除工作目录
git worktree remove ../project-hotfix
# 或手动删除文件夹后
git worktree prune
```

---

## 场景十一：大文件与 Git LFS

### 11.1 追踪大文件

```bash
# 安装 Git LFS
git lfs install

# 追踪特定类型的文件
git lfs track "*.psd"
git lfs track "*.zip"
git lfs track "*.mp4"

# 这会生成 .gitattributes 文件，需要提交
git add .gitattributes
git commit -m "chore: 配置 Git LFS 追踪规则"

# 查看 LFS 追踪的文件类型
git lfs track

# 查看 LFS 文件列表
git lfs ls-files
```

---

## 场景十二：子模块（Submodule）

### 12.1 添加子模块

```bash
# 场景：主项目依赖一个公共库，公共库有独立仓库
git submodule add git@github.com:company/shared-lib.git libs/shared

# 这会：
# 1. 克隆 shared-lib 到 libs/shared
# 2. 在主项目中创建 .gitmodules 文件
# 3. 提交 .gitmodules 和子模块引用
git add .
git commit -m "chore: 添加 shared-lib 子模块"
```

### 12.2 克隆含子模块的项目

```bash
# 方式一：克隆时一并初始化
git clone --recurse-submodules git@github.com:company/main-project.git

# 方式二：克隆后初始化
git clone git@github.com:company/main-project.git
cd main-project
git submodule init
git submodule update
```

### 12.3 更新子模块

```bash
# 更新所有子模块到远程最新
git submodule update --remote

# 更新指定子模块
git submodule update --remote libs/shared

# 进入子模块目录操作
cd libs/shared
git pull origin main
cd ../..
git add libs/shared
git commit -m "chore: 更新 shared-lib 子模块"
```

### 12.4 删除子模块

```bash
# 1. 取消注册
git submodule deinit libs/shared

# 2. 删除目录
git rm libs/shared

# 3. 删除 .git/modules 中的残留
rm -rf .git/modules/libs/shared

# 4. 提交
git commit -m "chore: 移除 shared-lib 子模块"
```

---

## 场景十三：二分查找 Bug（Git Bisect）

### 13.1 定位 bug 引入的提交

```bash
# 场景：发现一个 bug，知道在 v1.0.0 是好的，v1.2.0 开始有问题
# 但中间有 50 个提交，不知道是哪个引入的

# 1. 开始二分查找
git bisect start

# 2. 标记坏的版本（当前有 bug）
git bisect bad HEAD
# 或指定版本
git bisect bad v1.2.0

# 3. 标记好的版本
git bisect good v1.0.0

# 4. Git 会自动切换到中间的某个提交
#    现在测试这个版本有没有 bug
#    如果有 bug：git bisect bad
#    如果没问题：git bisect good

# 5. 重复第 4 步，直到 Git 告诉你：
#    "a1b2c3d is the first bad commit"

# 6. 结束二分查找
git bisect reset
```

### 13.2 自动化二分查找

```bash
# 如果有自动化测试脚本可以验证 bug
git bisect start
git bisect bad HEAD
git bisect good v1.0.0

# 自动运行测试脚本（返回 0 表示没问题，非 0 表示有 bug）
git bisect run npm test -- --testPathPattern=bug-related-test

# Git 会自动完成二分查找，找到引入 bug 的提交
```

---

## 场景十四：Git Hooks（钩子）

### 14.1 常用钩子说明

```
.git/hooks/
├── pre-commit         # 提交前触发（常用于 lint、格式化检查）
├── commit-msg         # 提交信息编写后触发（常用于校验提交信息格式）
├── pre-push           # 推送前触发（常用于运行测试）
├── post-checkout      # 切换分支后触发
├── post-merge         # 合并后触发
└── pre-rebase         # 变基前触发
```

### 14.2 示例：pre-commit 钩子运行 lint

```bash
# .git/hooks/pre-commit
#!/bin/bash
echo "Running ESLint..."

# 只检查暂存的 JS 文件
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.js$')

if [ -n "$FILES" ]; then
    npx eslint $FILES
    if [ $? -ne 0 ]; then
        echo "ESLint 检查不通过，提交已阻止"
        exit 1
    fi
fi

exit 0
```

```bash
# 给钩子添加执行权限
chmod +x .git/hooks/pre-commit
```

### 14.3 使用 husky 管理钩子（推荐）

```bash
# 安装 husky
npm install --save-dev husky

# 初始化
npx husky init

# 添加 pre-commit 钩子
echo "npx lint-staged" > .husky/pre-commit

# 添加 commit-msg 钩子（校验提交信息格式）
echo 'npx --no -- commitlint --edit "$1"' > .husky/commit-msg
```

---

## 场景十五：常见错误与恢复

### 15.1 误提交到错误的分支

```bash
# 场景：在 main 分支上做了提交，应该在 feature 分支

# 1. 创建 feature 分支（保存当前 commit）
git branch feature/saved-work

# 2. 回退 main
git checkout main
git reset --hard HEAD~1    # 或用 origin/main

# 3. 切换到新分支继续工作
git checkout feature/saved-work
```

### 15.2 误删分支

```bash
# 场景：用 git branch -D 删了分支，发现还有用

# 1. 找到删除前的 commit hash
git reflog
# 找到类似这样的行：
# a1b2c3d HEAD@{3}: checkout: moving from feature/deleted to main

# 2. 从那个 commit 恢复分支
git checkout -b feature/recovered a1b2c3d
```

### 15.3 误执行 git reset --hard

```bash
# reflog 始终能救你
git reflog
# 找到 reset 之前的 HEAD 位置
git reset --hard HEAD@{1}
```

### 15.4 提交时邮箱/用户名用错了

```bash
# 修改最近一次提交的作者信息
git commit --amend --author="张三 <zhangsan@company.com>"

# 修改多个历史提交的作者信息（用 rebase）
git rebase -i HEAD~5
# 把要修改的 pick 改成 edit
# 对每个 edit 执行：
git commit --amend --author="张三 <zhangsan@company.com>" --no-edit
git rebase --continue
```

### 15.5 .gitignore 不生效

```bash
# 原因：文件之前已经被 Git 追踪了，加到 .gitignore 只是忽略新改动

# 解决：先从 Git 索引中移除（但不删除文件）
git rm --cached filename
# 或整个目录
git rm -r --cached directory/

git commit -m "chore: 从 git 追踪中移除缓存文件"

# 现在 .gitignore 会生效
```

### 15.6 想把一个大提交拆成多个小提交

```bash
# 假设最近一次提交包含了太多改动，想拆成 3 个

git reset --soft HEAD~1    # 撤销提交，改动回到暂存区
git reset HEAD .           # 所有文件回到工作区

# 现在分批提交
git add src/part1/
git commit -m "feat: 第一部分 - 数据层"

git add src/part2/
git commit -m "feat: 第二部分 - 业务逻辑"

git add src/part3/
git commit -m "feat: 第三部分 - UI 层"
```

---

## 场景十六：Git 配置深入

### 16.1 全局 .gitignore

```bash
# 创建全局忽略规则（对所有项目生效）
git config --global core.excludesfile ~/.gitignore_global

# ~/.gitignore_global 内容示例：
# .DS_Store        (macOS)
# Thumbs.db        (Windows)
# *.log
# .vscode/
# .idea/
```

### 16.2 凭证存储

```bash
# 避免每次都输入密码
# Windows
git config --global credential.helper wincred

# macOS
git config --global credential.helper osxkeychain

# Linux
git config --global credential.helper cache --timeout=3600  # 缓存 1 小时
git config --global credential.helper store   # 明文存储（不安全）
```

### 16.3 常用别名推荐

```bash
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.unstage "reset HEAD --"
git config --global alias.last "log -1 HEAD"
git config --global alias.lg "log --oneline --graph --all --decorate"
git config --global alias.undo "reset --soft HEAD~1"
git config --global alias.amend "commit --amend --no-edit"
git config --global alias.force-push "push --force-with-lease"
git config --global alias.prune "remote prune origin"
```

---

## 场景十七：紧急修复（Hotfix）完整流程

```bash
# 场景：生产环境出了严重 bug，需要立即修复

# 1. 从生产分支（main）创建 hotfix 分支
git checkout main
git pull
git checkout -b hotfix/critical-bug

# 2. 修复 bug，提交
# ... 修改代码 ...
git add .
git commit -m "fix: 紧急修复支付超时导致订单丢失"

# 3. 推送并创建 PR
git push -u origin hotfix/critical-bug
# 在网页上创建 PR，加速 review 和合并

# 4. 合并到 main 后，打紧急发布标签
git checkout main
git pull
git tag -a v1.0.1-hotfix -m "紧急修复：支付超时"
git push origin v1.0.1-hotfix

# 5. 把修复也合并到 develop（避免下次发布时又出现）
git checkout develop
git pull
git merge hotfix/critical-bug
# 或 cherry-pick 那个修复提交
git cherry-pick <hotfix-commit-hash>
git push

# 6. 清理
git branch -d hotfix/critical-bug
git push origin --delete hotfix/critical-bug
```

---

## 场景十八：合并策略详解

### 18.1 三种合并方式

```bash
# 方式一：merge（创建合并提交）
git checkout main
git merge feature/branch
# 结果：保留分支历史 + 一个 merge commit

# 方式二：squash merge（压缩为一个提交）
git checkout main
git merge --squash feature/branch
git commit -m "feat: 完整功能（压缩合并）"
# 结果：feature 的所有改动变成一个提交，分支历史不保留

# 方式三：rebase merge（线性历史，快进合并）
git checkout feature/branch
git rebase main
git checkout main
git merge feature/branch       # 快进合并，无 merge commit
# 或
git merge --ff-only feature/branch
```

### 18.2 各策略的适用场景

```
merge:       公共分支合并，需要保留完整上下文
squash:      feature 分支提交太零碎，想压成一个干净的提交
rebase+ff:   追求线性历史，feature 提交本身已经足够干净
```

---

## 附录：速查表

```
┌─────────────────────────────────────────────────────────────────────┐
│  想做什么                          │  命令                           │
├─────────────────────────────────────────────────────────────────────┤
│  查看状态                          │  git status                     │
│  查看改动                          │  git diff                       │
│  查看历史                          │  git log --oneline --graph      │
│  暂存所有改动                      │  git add .                      │
│  暂存部分改动                      │  git add -p                     │
│  提交                              │  git commit -m "..."            │
│  修改最近提交                      │  git commit --amend             │
│  切换分支                          │  git checkout <branch>          │
│  创建并切换分支                    │  git checkout -b <branch>       │
│  合并分支                          │  git merge <branch>             │
│  变基                              │  git rebase <branch>            │
│  拉取更新                          │  git pull                       │
│  推送                              │  git push                       │
│  暂存工作现场                      │  git stash                      │
│  恢复工作现场                      │  git stash pop                  │
│  撤销工作区改动                    │  git checkout -- <file>         │
│  取消暂存                          │  git reset HEAD <file>          │
│  撤销提交（保留改动）              │  git reset --soft HEAD~1        │
│  安全撤销已推送提交                │  git revert <commit>            │
│  找回丢失的提交                    │  git reflog                     │
│  整理提交历史                      │  git rebase -i HEAD~N           │
│  摘取提交                          │  git cherry-pick <commit>      │
│  查看谁改的                        │  git blame <file>               │
│  创建标签                          │  git tag -a v1.0.0 -m "..."    │
│  删除分支                          │  git branch -d <branch>         │
│  二分查找 bug                      │  git bisect start               │
│  解决冲突后继续                    │  git add . && git merge --cont  │
└─────────────────────────────────────────────────────────────────────┘
```
