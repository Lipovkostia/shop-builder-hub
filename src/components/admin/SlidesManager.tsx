import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, ImageIcon, Loader2, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import useEmblaCarousel from 'embla-carousel-react';

interface Slide {
  id: string;
  title: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export default function SlidesManager() {
  const { toast } = useToast();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });

  // Track local edits for current slide
  const [editTitle, setEditTitle] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSlides();
  }, []);

  // Sync embla with currentIndex
  useEffect(() => {
    if (emblaApi) {
      emblaApi.on('select', () => {
        const newIndex = emblaApi.selectedScrollSnap();
        setCurrentIndex(newIndex);
      });
    }
  }, [emblaApi]);

  // Update editTitle when currentIndex changes
  useEffect(() => {
    if (slides[currentIndex]) {
      setEditTitle(slides[currentIndex].title);
      setHasChanges(false);
    }
  }, [currentIndex, slides]);

  const fetchSlides = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('landing_slides')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSlides(data || []);
      if (data && data.length > 0) {
        setEditTitle(data[0].title);
      }
    } catch (error) {
      console.error('Error fetching slides:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить слайды',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const currentSlide = slides[currentIndex];

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const scrollTo = useCallback((index: number) => {
    if (emblaApi) emblaApi.scrollTo(index);
  }, [emblaApi]);

  const handleAddSlide = async () => {
    const maxSortOrder = slides.length > 0 
      ? Math.max(...slides.map(s => s.sort_order)) 
      : 0;

    try {
      const { data, error } = await supabase
        .from('landing_slides')
        .insert({
          title: 'Новый слайд',
          sort_order: maxSortOrder + 1,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      const newSlides = [...slides, data];
      setSlides(newSlides);
      
      // Navigate to new slide
      setTimeout(() => {
        scrollTo(newSlides.length - 1);
      }, 100);
      
      toast({ title: 'Слайд добавлен' });
    } catch (error) {
      console.error('Error adding slide:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить слайд',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteSlide = async () => {
    if (!currentSlide) return;
    if (!confirm('Удалить этот слайд?')) return;

    try {
      // Delete image from storage if exists
      if (currentSlide.image_url && currentSlide.image_url.includes('landing-slides')) {
        const path = currentSlide.image_url.split('/landing-slides/')[1];
        if (path) {
          await supabase.storage.from('landing-slides').remove([path]);
        }
      }

      const { error } = await supabase
        .from('landing_slides')
        .delete()
        .eq('id', currentSlide.id);

      if (error) throw error;

      const newSlides = slides.filter(s => s.id !== currentSlide.id);
      setSlides(newSlides);
      
      // Adjust current index
      if (currentIndex >= newSlides.length && newSlides.length > 0) {
        setTimeout(() => scrollTo(newSlides.length - 1), 100);
      }
      
      toast({ title: 'Слайд удалён' });
    } catch (error) {
      console.error('Error deleting slide:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить слайд',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async () => {
    if (!currentSlide) return;
    
    const newIsActive = !currentSlide.is_active;
    
    try {
      const { error } = await supabase
        .from('landing_slides')
        .update({ is_active: newIsActive })
        .eq('id', currentSlide.id);

      if (error) throw error;

      setSlides(slides.map(s => 
        s.id === currentSlide.id ? { ...s, is_active: newIsActive } : s
      ));
      
      toast({ 
        title: newIsActive ? 'Слайд включён' : 'Слайд скрыт' 
      });
    } catch (error) {
      console.error('Error toggling slide:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить слайд',
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentSlide) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Ошибка',
        description: 'Можно загружать только изображения',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Ошибка',
        description: 'Размер файла не должен превышать 5 МБ',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      // Generate unique filename
      const ext = file.name.split('.').pop();
      const fileName = `${currentSlide.id}-${Date.now()}.${ext}`;

      // Delete old image if exists
      if (currentSlide.image_url && currentSlide.image_url.includes('landing-slides')) {
        const oldPath = currentSlide.image_url.split('/landing-slides/')[1];
        if (oldPath) {
          await supabase.storage.from('landing-slides').remove([oldPath]);
        }
      }

      // Upload new image
      const { error: uploadError } = await supabase.storage
        .from('landing-slides')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('landing-slides')
        .getPublicUrl(fileName);

      // Update slide in DB
      const { error: updateError } = await supabase
        .from('landing_slides')
        .update({ image_url: urlData.publicUrl })
        .eq('id', currentSlide.id);

      if (updateError) throw updateError;

      // Update local state
      setSlides(slides.map(s => 
        s.id === currentSlide.id ? { ...s, image_url: urlData.publicUrl } : s
      ));

      toast({ title: 'Изображение загружено' });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить изображение. Проверьте права доступа.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleTitleChange = (value: string) => {
    setEditTitle(value);
    setHasChanges(true);
  };

  const handleTitleBlur = async () => {
    if (!currentSlide || !hasChanges) return;
    if (editTitle === currentSlide.title) {
      setHasChanges(false);
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('landing_slides')
        .update({ title: editTitle })
        .eq('id', currentSlide.id);

      if (error) throw error;

      setSlides(slides.map(s =>
        s.id === currentSlide.id ? { ...s, title: editTitle } : s
      ));
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving title:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить текст',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const moveSlide = async (direction: 'prev' | 'next') => {
    if (!currentSlide) return;
    
    const targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;

    const targetSlide = slides[targetIndex];
    
    try {
      // Swap sort_order values
      await Promise.all([
        supabase
          .from('landing_slides')
          .update({ sort_order: targetSlide.sort_order })
          .eq('id', currentSlide.id),
        supabase
          .from('landing_slides')
          .update({ sort_order: currentSlide.sort_order })
          .eq('id', targetSlide.id),
      ]);

      // Update local state
      const newSlides = [...slides];
      [newSlides[currentIndex], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[currentIndex]];
      
      // Also swap sort_order in local state
      const tempSortOrder = newSlides[currentIndex].sort_order;
      newSlides[currentIndex] = { ...newSlides[currentIndex], sort_order: newSlides[targetIndex].sort_order };
      newSlides[targetIndex] = { ...newSlides[targetIndex], sort_order: tempSortOrder };
      
      setSlides(newSlides);
      
      // Navigate to new position
      setTimeout(() => scrollTo(targetIndex), 100);
    } catch (error) {
      console.error('Error reordering:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось изменить порядок',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Слайды на главной странице</h3>

      {slides.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">Нет слайдов</p>
          <Button onClick={handleAddSlide}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить первый слайд
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Navigation header */}
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              size="icon"
              onClick={scrollPrev}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <span className="text-sm text-muted-foreground">
              Слайд {currentIndex + 1} из {slides.length}
            </span>
            
            <Button 
              variant="outline" 
              size="icon"
              onClick={scrollNext}
              disabled={currentIndex === slides.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Carousel preview editor */}
          <div 
            className={`overflow-hidden rounded-xl border-2 ${
              currentSlide?.is_active 
                ? 'border-primary/20' 
                : 'border-destructive/30 bg-destructive/5'
            }`}
            ref={emblaRef}
          >
            <div className="flex">
              {slides.map((slide, index) => (
                <div 
                  key={slide.id} 
                  className="flex-[0_0_100%] min-w-0"
                >
                  {/* Slide preview - mimics main page appearance */}
                  <div className="aspect-[16/9] sm:aspect-[21/9] relative bg-gradient-to-b from-muted/50 to-muted">
                    {/* Image area - clickable to upload */}
                    <input
                      ref={index === currentIndex ? fileInputRef : undefined}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    
                    {slide.image_url ? (
                      <div 
                        className="absolute inset-0 cursor-pointer group"
                        onClick={() => index === currentIndex && fileInputRef.current?.click()}
                      >
                        <img
                          src={slide.image_url}
                          alt={slide.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium">
                            {isUploading && index === currentIndex ? (
                              <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                              'Нажмите, чтобы заменить'
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => index === currentIndex && fileInputRef.current?.click()}
                      >
                        {isUploading && index === currentIndex ? (
                          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                            <span className="text-sm text-muted-foreground">
                              Нажмите, чтобы загрузить фото
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Inactive overlay */}
                    {!slide.is_active && (
                      <div className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded">
                        Скрыт
                      </div>
                    )}
                  </div>

                  {/* Text field - editable */}
                  <div className="p-3 sm:p-4 bg-card">
                    <Input
                      value={index === currentIndex ? editTitle : slide.title}
                      onChange={(e) => index === currentIndex && handleTitleChange(e.target.value)}
                      onBlur={handleTitleBlur}
                      placeholder="Введите текст слайда..."
                      className="text-center text-base sm:text-lg font-medium border-none shadow-none bg-transparent focus-visible:ring-1 focus-visible:ring-primary/50"
                      disabled={index !== currentIndex}
                    />
                    {isSaving && index === currentIndex && (
                      <p className="text-xs text-muted-foreground text-center mt-1">Сохранение...</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Control panel */}
          <div className="flex flex-col gap-3">
            {/* Dots navigation */}
            <div className="flex justify-center gap-1.5">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  onClick={() => scrollTo(index)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    index === currentIndex 
                      ? 'bg-primary' 
                      : slide.is_active 
                        ? 'bg-muted-foreground/30 hover:bg-muted-foreground/50' 
                        : 'bg-destructive/30 hover:bg-destructive/50'
                  }`}
                  aria-label={`Перейти к слайду ${index + 1}`}
                />
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => moveSlide('prev')}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Влево
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => moveSlide('next')}
                disabled={currentIndex === slides.length - 1}
              >
                Вправо
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>

              <div className="w-px h-6 bg-border hidden sm:block" />

              <Button 
                variant={currentSlide?.is_active ? "outline" : "secondary"}
                size="sm"
                onClick={handleToggleActive}
              >
                {currentSlide?.is_active ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-1" />
                    Скрыть
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-1" />
                    Показать
                  </>
                )}
              </Button>

              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleDeleteSlide}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Удалить
              </Button>

              <div className="w-px h-6 bg-border hidden sm:block" />

              <Button 
                size="sm"
                onClick={handleAddSlide}
              >
                <Plus className="h-4 w-4 mr-1" />
                Добавить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
