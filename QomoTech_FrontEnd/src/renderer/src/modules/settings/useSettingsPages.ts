import { computed } from 'vue'
import { createControllerSections, createRecipeSections } from '@/configs/settings'
import { deviceFeatureRoutes } from '@/app/router'
import { useControllerSettingsStore } from '@/stores/controllerSettingsStore'
import { useRecipeSettingsStore } from '@/stores/recipeSettingsStore'
import { useReservePagesStore } from '@/stores/settings'

export const useControllerSettingsPage = () => {
  const controllerStore = useControllerSettingsStore()

  return {
    navigationLinks: deviceFeatureRoutes,
    controllerSettings: computed(() => controllerStore.controllerSettings),
    sections: computed(() => createControllerSections(controllerStore.controllerSettings))
  }
}

export const useRecipeManagementPage = () => {
  const recipeStore = useRecipeSettingsStore()

  return {
    navigationLinks: deviceFeatureRoutes,
    recipeState: computed(() => recipeStore.recipeState),
    sections: computed(() => createRecipeSections(recipeStore.recipeState))
  }
}

export const useReservePages = () => {
  const reserveStore = useReservePagesStore()

  return {
    navigationLinks: deviceFeatureRoutes,
    reservePages: computed(() => reserveStore.reservePages),
    getReservePageByPath: (path: string) =>
      reserveStore.reservePages.find((page) => page.path === path) ?? reserveStore.reservePages[0]
  }
}
