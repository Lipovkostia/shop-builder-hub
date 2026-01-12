import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, GripVertical, ImageIcon, Save, X, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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
  const [editingSlide, setEditingSlide] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSlides();
  }, []);

  const fetchSlides = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('landing_slides')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSlides(data || []);
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

      setSlides([...slides, data]);
      setEditingSlide(data.id);
      setEditTitle(data.title);
      setEditImageUrl('');
      
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

  const handleDeleteSlide = async (id: string) => {
    if (!confirm('Удалить этот слайд?')) return;

    const slide = slides.find(s => s.id === id);
    
    try {
      // Delete image from storage if exists
      if (slide?.image_url && slide.image_url.includes('landing-slides')) {
        const path = slide.image_url.split('/landing-slides/')[1];
        if (path) {
          await supabase.storage.from('landing-slides').remove([path]);
        }
      }

      const { error } = await supabase
        .from('landing_slides')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSlides(slides.filter(s => s.id !== id));
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

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('landing_slides')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      setSlides(slides.map(s => 
        s.id === id ? { ...s, is_active: isActive } : s
      ));
    } catch (error) {
      console.error('Error toggling slide:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить слайд',
        variant: 'destructive',
      });
    }
  };

  const startEditing = (slide: Slide) => {
    setEditingSlide(slide.id);
    setEditTitle(slide.title);
    setEditImageUrl(slide.image_url || '');
  };

  const cancelEditing = () => {
    setEditingSlide(null);
    setEditTitle('');
    setEditImageUrl('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editingSlide) return;

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
      const fileName = `${editingSlide}-${Date.now()}.${ext}`;

      // Delete old image if exists
      if (editImageUrl && editImageUrl.includes('landing-slides')) {
        const oldPath = editImageUrl.split('/landing-slides/')[1];
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

      setEditImageUrl(urlData.publicUrl);
      toast({ title: 'Изображение загружено' });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить изображение',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const saveEditing = async () => {
    if (!editingSlide) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('landing_slides')
        .update({
          title: editTitle,
          image_url: editImageUrl || null,
        })
        .eq('id', editingSlide);

      if (error) throw error;

      setSlides(slides.map(s =>
        s.id === editingSlide
          ? { ...s, title: editTitle, image_url: editImageUrl || null }
          : s
      ));

      setEditingSlide(null);
      toast({ title: 'Слайд сохранён' });
    } catch (error) {
      console.error('Error saving slide:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить слайд',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const moveSlide = async (id: string, direction: 'up' | 'down') => {
    const index = slides.findIndex(s => s.id === id);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === slides.length - 1)
    ) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newSlides = [...slides];
    const temp = newSlides[index];
    newSlides[index] = newSlides[newIndex];
    newSlides[newIndex] = temp;

    // Update sort_order
    const updates = newSlides.map((s, i) => ({
      id: s.id,
      sort_order: i + 1,
    }));

    try {
      for (const update of updates) {
        await supabase
          .from('landing_slides')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }

      setSlides(newSlides.map((s, i) => ({ ...s, sort_order: i + 1 })));
    } catch (error) {
      console.error('Error reordering slides:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось изменить порядок',
        variant: 'destructive',
      });
    }
  };

  const removeImage = async () => {
    if (editImageUrl && editImageUrl.includes('landing-slides')) {
      const path = editImageUrl.split('/landing-slides/')[1];
      if (path) {
        await supabase.storage.from('landing-slides').remove([path]);
      }
    }
    setEditImageUrl('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Слайды на главной странице</h3>
        <Button onClick={handleAddSlide} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Добавить слайд
        </Button>
      </div>

      <div className="space-y-3">
        {slides.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Нет слайдов. Добавьте первый слайд.
          </p>
        ) : (
          slides.map((slide, index) => (
            <Card key={slide.id} className={!slide.is_active ? 'opacity-50' : ''}>
              <CardContent className="p-4">
                {editingSlide === slide.id ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Текст слайда</Label>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Текст слайда"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Изображение</Label>
                      
                      {/* Upload button */}
                      <div className="flex gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Загрузка...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-1" />
                              Загрузить изображение
                            </>
                          )}
                        </Button>
                        {editImageUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={removeImage}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Удалить
                          </Button>
                        )}
                      </div>

                      {/* Image preview */}
                      {editImageUrl && (
                        <div className="mt-2 aspect-[16/9] w-full max-w-md overflow-hidden rounded-lg border">
                          <img
                            src={editImageUrl}
                            alt="Превью"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {/* URL input as fallback */}
                      <div className="pt-2">
                        <Label className="text-xs text-muted-foreground">
                          Или введите URL изображения:
                        </Label>
                        <Input
                          value={editImageUrl}
                          onChange={(e) => setEditImageUrl(e.target.value)}
                          placeholder="https://example.com/image.png"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={saveEditing}
                        disabled={isSaving || isUploading}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Сохранить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEditing}
                        disabled={isSaving || isUploading}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveSlide(slide.id, 'up')}
                        disabled={index === 0}
                      >
                        <GripVertical className="h-4 w-4 rotate-90" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveSlide(slide.id, 'down')}
                        disabled={index === slides.length - 1}
                      >
                        <GripVertical className="h-4 w-4 rotate-90" />
                      </Button>
                    </div>

                    {slide.image_url ? (
                      <div className="w-24 h-14 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={slide.image_url}
                          alt={slide.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-medium line-clamp-2">{slide.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Позиция: {slide.sort_order}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={slide.is_active}
                          onCheckedChange={(checked) => handleToggleActive(slide.id, checked)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {slide.is_active ? 'Активен' : 'Скрыт'}
                        </span>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEditing(slide)}
                      >
                        Изменить
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteSlide(slide.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
