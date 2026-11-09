"""Independent, frontend-only character multiview workbench extension."""
from comfy_api.latest import ComfyExtension

WEB_DIRECTORY = "./web"

class CharacterMultiviewExtension(ComfyExtension):
    async def get_node_list(self):
        return []

async def comfy_entrypoint():
    return CharacterMultiviewExtension()
