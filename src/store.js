import create from 'zustand';

export const useStore = create((set, get) => ({
  slides: [],
  currentSlideIndex: 0,
  selectedElementId: null,
  setSlides: (slides) => set({ slides }),
  setCurrentSlideIndex: (i) => set({ currentSlideIndex: i }),
  updateSlide: (index, updater) => {
    const slides = [...get().slides];
    slides[index] = { ...slides[index], ...updater(slides[index]) };
    set({ slides });
  }
}));