import React, { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, X, Trash2, Plus, Upload, Image as ImageIcon, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageGalleryViewerProps {
  images: string[];
  productName: string;
  productId: string;
  onDeleteImage: (index: number) => void;
  onAddImages: (files: FileList, source: 'file' | 'camera') => void;
  isDeleting?: boolean;
  isUploading?: boolean;
}

export const ImageGalleryViewer: React.FC<ImageGalleryViewerProps> = ({
  images,
  productName,
  productId,
  onDeleteImage,
  onAddImages,
  isDeleting = false,
  isUploading = false,
}) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const openViewer = (index: number) => {
    setCurrentIndex(index);
    setViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerOpen(false);
  };

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, images.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewerOpen) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'Escape') closeViewer();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerOpen, goNext, goPrev]);

  // Touch handlers for swipe
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) goNext();
    if (isRightSwipe) goPrev();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddImages(e.target.files, 'file');
      e.target.value = '';
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddImages(e.target.files, 'camera');
      e.target.value = '';
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmIndex !== null) {
      onDeleteImage(deleteConfirmIndex);
      setDeleteConfirmIndex(null);
      // Adjust current index if needed
      if (currentIndex >= images.length - 1 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />

      {/* Thumbnail Gallery */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin items-center">
        {images.map((imgSrc, idx) => (
          <div
            key={idx}
            className="flex-shrink-0 relative group"
          >
            <img
              src={imgSrc}
              alt={`${productName} - фото ${idx + 1}`}
              className="h-24 w-24 object-cover rounded-lg border border-border cursor-pointer hover:border-primary transition-colors"
              onClick={() => openViewer(idx)}
            />
            {/* Delete button on hover */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirmIndex(idx);
              }}
              className="absolute top-1 right-1 p-1 bg-destructive/90 text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
              disabled={isDeleting}
            >
              <Trash2 className="h-3 w-3" />
            </button>
            <div className="absolute bottom-1 right-1 bg-background/80 text-foreground text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              {idx + 1}
            </div>
          </div>
        ))}

        {/* Add Photo Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex-shrink-0 h-24 w-24 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors disabled:opacity-50"
              disabled={isUploading}
            >
              {isUploading ? (
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              ) : (
                <Plus className="h-6 w-6 text-muted-foreground" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Загрузить с компьютера
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Выбрать из медиатеки
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
              <Camera className="h-4 w-4 mr-2" />
              Сделать фото
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* No images message */}
      {images.length === 0 && (
        <div className="text-muted-foreground text-sm py-2">
          Нет изображений. Нажмите + чтобы добавить.
        </div>
      )}

      {/* Fullscreen Viewer Dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent 
          className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 bg-black/95 border-none"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div 
            className="relative w-full h-full flex items-center justify-center"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
              onClick={closeViewer}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Delete button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 left-4 z-50 text-white hover:bg-destructive/80"
              onClick={() => setDeleteConfirmIndex(currentIndex)}
              disabled={isDeleting}
            >
              <Trash2 className="h-6 w-6" />
            </Button>

            {/* Image counter */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 text-white bg-black/50 px-3 py-1 rounded-full text-sm">
              {currentIndex + 1} / {images.length}
            </div>

            {/* Previous button */}
            {currentIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
                onClick={goPrev}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
            )}

            {/* Main image */}
            {images[currentIndex] && (
              <img
                src={images[currentIndex]}
                alt={`${productName} - фото ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain select-none"
                draggable={false}
              />
            )}

            {/* Next button */}
            {currentIndex < images.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
                onClick={goNext}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            )}

            {/* Thumbnail strip */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 overflow-x-auto max-w-[90vw] p-2 bg-black/50 rounded-lg">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-colors",
                    idx === currentIndex ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmIndex !== null} onOpenChange={(open) => !open && setDeleteConfirmIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить изображение?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Изображение будет удалено из хранилища.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
