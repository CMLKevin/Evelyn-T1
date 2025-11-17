/**
 * Unified Layout Management System
 * Provides centralized control over canvas layout, persistence, and animations
 */

import { useState, useEffect } from 'react';

export interface LayoutConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  panels: {
    leftSidebar: boolean;
    rightSidebar: boolean;
    bottomPanel: boolean;
    breadcrumbs: boolean;
    statusBar: boolean;
  };
  sizes: {
    leftSidebar: number;
    rightSidebar: number;
    bottomPanel: number;
  };
  responsive: {
    sm: Partial<LayoutConfig['panels']>;
    md: Partial<LayoutConfig['panels']>;
    lg: Partial<LayoutConfig['panels']>;
  };
}

export interface LayoutState {
  currentLayout: string;
  customLayouts: LayoutConfig[];
  isAnimating: boolean;
  breakpoint: 'sm' | 'md' | 'lg';
}

class LayoutManager {
  private static instance: LayoutManager;
  private state: LayoutState;
  private listeners: Set<(state: LayoutState) => void> = new Set();
  private breakpoints = {
    sm: 640,
    md: 768,
    lg: 1024
  };

  private defaultLayouts: LayoutConfig[] = [
    {
      id: 'full-editor',
      name: 'Full Editor',
      description: 'Maximum coding space with all panels hidden',
      icon: 'Maximize2',
      panels: {
        leftSidebar: false,
        rightSidebar: false,
        bottomPanel: false,
        breadcrumbs: false,
        statusBar: true
      },
      sizes: {
        leftSidebar: 280,
        rightSidebar: 320,
        bottomPanel: 200
      },
      responsive: {
        sm: { leftSidebar: false, rightSidebar: false, bottomPanel: false },
        md: { leftSidebar: false, rightSidebar: false, bottomPanel: false },
        lg: { leftSidebar: false, rightSidebar: false, bottomPanel: false }
      }
    },
    {
      id: 'editor-right',
      name: 'Editor + Right Panel',
      description: 'Editor with suggestions and AI assistant panel',
      icon: 'LayoutPanelRight',
      panels: {
        leftSidebar: false,
        rightSidebar: true,
        bottomPanel: false,
        breadcrumbs: true,
        statusBar: true
      },
      sizes: {
        leftSidebar: 280,
        rightSidebar: 320,
        bottomPanel: 200
      },
      responsive: {
        sm: { leftSidebar: false, rightSidebar: false, bottomPanel: false },
        md: { leftSidebar: false, rightSidebar: true, bottomPanel: false },
        lg: { leftSidebar: false, rightSidebar: true, bottomPanel: false }
      }
    },
    {
      id: 'editor-left',
      name: 'Editor + Left Panel',
      description: 'Editor with file explorer and navigation',
      icon: 'LayoutPanelLeft',
      panels: {
        leftSidebar: true,
        rightSidebar: false,
        bottomPanel: false,
        breadcrumbs: true,
        statusBar: true
      },
      sizes: {
        leftSidebar: 280,
        rightSidebar: 320,
        bottomPanel: 200
      },
      responsive: {
        sm: { leftSidebar: false, rightSidebar: false, bottomPanel: false },
        md: { leftSidebar: true, rightSidebar: false, bottomPanel: false },
        lg: { leftSidebar: true, rightSidebar: false, bottomPanel: false }
      }
    },
    {
      id: 'all-panels',
      name: 'All Panels',
      description: 'Complete workspace with all panels visible',
      icon: 'LayoutGrid',
      panels: {
        leftSidebar: true,
        rightSidebar: true,
        bottomPanel: true,
        breadcrumbs: true,
        statusBar: true
      },
      sizes: {
        leftSidebar: 280,
        rightSidebar: 320,
        bottomPanel: 200
      },
      responsive: {
        sm: { leftSidebar: false, rightSidebar: false, bottomPanel: true },
        md: { leftSidebar: true, rightSidebar: false, bottomPanel: true },
        lg: { leftSidebar: true, rightSidebar: true, bottomPanel: true }
      }
    },
    {
      id: 'focus-mode',
      name: 'Focus Mode',
      description: 'Distraction-free coding with minimal UI',
      icon: 'Focus',
      panels: {
        leftSidebar: false,
        rightSidebar: false,
        bottomPanel: false,
        breadcrumbs: false,
        statusBar: false
      },
      sizes: {
        leftSidebar: 280,
        rightSidebar: 320,
        bottomPanel: 200
      },
      responsive: {
        sm: { leftSidebar: false, rightSidebar: false, bottomPanel: false },
        md: { leftSidebar: false, rightSidebar: false, bottomPanel: false },
        lg: { leftSidebar: false, rightSidebar: false, bottomPanel: false }
      }
    },
    {
      id: 'debug-layout',
      name: 'Debug Layout',
      description: 'Optimized for debugging with bottom panel',
      icon: 'Bug',
      panels: {
        leftSidebar: true,
        rightSidebar: false,
        bottomPanel: true,
        breadcrumbs: true,
        statusBar: true
      },
      sizes: {
        leftSidebar: 280,
        rightSidebar: 320,
        bottomPanel: 300
      },
      responsive: {
        sm: { leftSidebar: false, rightSidebar: false, bottomPanel: true },
        md: { leftSidebar: true, rightSidebar: false, bottomPanel: true },
        lg: { leftSidebar: true, rightSidebar: false, bottomPanel: true }
      }
    }
  ];

  private constructor() {
    this.state = this.loadState();
    this.setupBreakpointListener();
  }

  static getInstance(): LayoutManager {
    if (!LayoutManager.instance) {
      LayoutManager.instance = new LayoutManager();
    }
    return LayoutManager.instance;
  }

  private loadState(): LayoutState {
    try {
      const saved = localStorage.getItem('canvas-layout-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          currentLayout: parsed.currentLayout || 'editor-right',
          customLayouts: parsed.customLayouts || [],
          isAnimating: false,
          breakpoint: this.getCurrentBreakpoint()
        };
      }
    } catch (error) {
      console.warn('Failed to load layout state:', error);
    }

    return {
      currentLayout: 'editor-right',
      customLayouts: [],
      isAnimating: false,
      breakpoint: this.getCurrentBreakpoint()
    };
  }

  private saveState(): void {
    try {
      localStorage.setItem('canvas-layout-state', JSON.stringify({
        currentLayout: this.state.currentLayout,
        customLayouts: this.state.customLayouts
      }));
    } catch (error) {
      console.warn('Failed to save layout state:', error);
    }
  }

  private setupBreakpointListener(): void {
    const updateBreakpoint = () => {
      const newBreakpoint = this.getCurrentBreakpoint();
      if (newBreakpoint !== this.state.breakpoint) {
        this.state.breakpoint = newBreakpoint;
        this.notifyListeners();
      }
    };

    window.addEventListener('resize', updateBreakpoint);
    updateBreakpoint(); // Initial check
  }

  private getCurrentBreakpoint(): 'sm' | 'md' | 'lg' {
    const width = window.innerWidth;
    if (width < this.breakpoints.sm) return 'sm';
    if (width < this.breakpoints.md) return 'md';
    return 'lg';
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  // Public API
  getState(): LayoutState {
    return { ...this.state };
  }

  getCurrentLayout(): LayoutConfig {
    const allLayouts = [...this.defaultLayouts, ...this.state.customLayouts];
    const layout = allLayouts.find(l => l.id === this.state.currentLayout);
    return layout || this.defaultLayouts[1]; // Fallback to editor-right
  }

  getAvailableLayouts(): LayoutConfig[] {
    return [...this.defaultLayouts, ...this.state.customLayouts];
  }

  async setLayout(layoutId: string, animated: boolean = true): Promise<void> {
    const allLayouts = [...this.defaultLayouts, ...this.state.customLayouts];
    const layout = allLayouts.find(l => l.id === layoutId);
    
    if (!layout) {
      throw new Error(`Layout "${layoutId}" not found`);
    }

    if (animated) {
      this.state.isAnimating = true;
      this.notifyListeners();
      
      // Allow animation to complete
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    this.state.currentLayout = layoutId;
    this.state.isAnimating = false;
    this.saveState();
    this.notifyListeners();
  }

  getEffectivePanelVisibility(): LayoutConfig['panels'] {
    const layout = this.getCurrentLayout();
    const responsiveConfig = layout.responsive[this.state.breakpoint];
    
    return {
      ...layout.panels,
      ...responsiveConfig
    };
  }

  getPanelSizes(): LayoutConfig['sizes'] {
    const layout = this.getCurrentLayout();
    return { ...layout.sizes };
  }

  async togglePanel(panel: keyof LayoutConfig['panels']): Promise<void> {
    const currentLayout = this.getCurrentLayout();
    const newPanels = {
      ...currentLayout.panels,
      [panel]: !currentLayout.panels[panel]
    };

    // Create a custom layout if it differs from defaults
    const customLayout: LayoutConfig = {
      ...currentLayout,
      id: `custom-${Date.now()}`,
      name: 'Custom Layout',
      description: 'User-modified layout',
      icon: 'Settings',
      panels: newPanels
    };

    this.state.customLayouts = [
      ...this.state.customLayouts.filter(l => !l.name.startsWith('Custom Layout')),
      customLayout
    ];

    await this.setLayout(customLayout.id);
  }

  async setPanelSize(panel: keyof LayoutConfig['sizes'], size: number): Promise<void> {
    const currentLayout = this.getCurrentLayout();
    const newSizes = {
      ...currentLayout.sizes,
      [panel]: Math.max(100, Math.min(500, size)) // Clamp between 100-500px
    };

    // Create a custom layout with new sizes
    const customLayout: LayoutConfig = {
      ...currentLayout,
      id: `custom-${Date.now()}`,
      name: 'Custom Layout',
      description: 'User-modified layout',
      icon: 'Settings',
      sizes: newSizes
    };

    this.state.customLayouts = [
      ...this.state.customLayouts.filter(l => !l.name.startsWith('Custom Layout')),
      customLayout
    ];

    await this.setLayout(customLayout.id);
  }

  saveCustomLayout(layout: Omit<LayoutConfig, 'id'>): string {
    const id = `custom-${Date.now()}`;
    const newLayout: LayoutConfig = { ...layout, id };
    
    this.state.customLayouts.push(newLayout);
    this.saveState();
    this.notifyListeners();
    
    return id;
  }

  deleteCustomLayout(layoutId: string): void {
    this.state.customLayouts = this.state.customLayouts.filter(l => l.id !== layoutId);
    
    // If we deleted the current layout, switch to a default one
    if (this.state.currentLayout === layoutId) {
      this.state.currentLayout = 'editor-right';
    }
    
    this.saveState();
    this.notifyListeners();
  }

  resetToDefaults(): void {
    this.state.currentLayout = 'editor-right';
    this.state.customLayouts = [];
    this.saveState();
    this.notifyListeners();
  }

  subscribe(listener: (state: LayoutState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Animation utilities
  animateTransition(from: LayoutConfig, to: LayoutConfig, duration: number = 300): Promise<void> {
    return new Promise(resolve => {
      this.state.isAnimating = true;
      this.notifyListeners();
      
      setTimeout(() => {
        this.state.isAnimating = false;
        this.notifyListeners();
        resolve();
      }, duration);
    });
  }

  // Responsive utilities
  getBreakpoint(): 'sm' | 'md' | 'lg' {
    return this.state.breakpoint;
  }

  isMobile(): boolean {
    return this.state.breakpoint === 'sm';
  }

  isTablet(): boolean {
    return this.state.breakpoint === 'md';
  }

  isDesktop(): boolean {
    return this.state.breakpoint === 'lg';
  }
}

// Export singleton instance
export const layoutManager = LayoutManager.getInstance();

// React hook for using layout manager
export function useLayoutManager() {
  const [state, setState] = useState<LayoutState>(layoutManager.getState());
  
  useEffect(() => {
    return layoutManager.subscribe(setState);
  }, []);

  return {
    ...state,
    currentLayout: layoutManager.getCurrentLayout(),
    availableLayouts: layoutManager.getAvailableLayouts(),
    effectivePanels: layoutManager.getEffectivePanelVisibility(),
    panelSizes: layoutManager.getPanelSizes(),
    setLayout: layoutManager.setLayout.bind(layoutManager),
    togglePanel: layoutManager.togglePanel.bind(layoutManager),
    setPanelSize: layoutManager.setPanelSize.bind(layoutManager),
    saveCustomLayout: layoutManager.saveCustomLayout.bind(layoutManager),
    deleteCustomLayout: layoutManager.deleteCustomLayout.bind(layoutManager),
    resetToDefaults: layoutManager.resetToDefaults.bind(layoutManager),
    isMobile: layoutManager.isMobile.bind(layoutManager),
    isTablet: layoutManager.isTablet.bind(layoutManager),
    isDesktop: layoutManager.isDesktop.bind(layoutManager)
  };
}
