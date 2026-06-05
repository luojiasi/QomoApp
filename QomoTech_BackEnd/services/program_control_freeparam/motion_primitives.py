


from services.MotionService import MotionService


class 自由编辑参数的额外运动控制:
    def __init__(self, 运动服务: MotionService) -> None:
        self._运动服务 = 运动服务
    async def 开启吹风(self) -> None:
        await self._运动服务.设置输出(0, True)
    async def 关闭吹风(self) -> None:
        await self._运动服务.设置输出(0, False)
    async def 开启激光(self) -> None:
        await self._运动服务.设置输出(2, True)
    async def 关闭激光(self) -> None:
        await self._运动服务.设置输出(2, False)
