import { useToast } from "@/hooks/use-toast";
import { useProfileSettings } from "@/hooks/useProfileSettings";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();
  const { toastEnabled } = useProfileSettings();

  // Don't render toasts if user has disabled them
  if (!toastEnabled) {
    return null;
  }

  return (
    <ToastProvider duration={1000}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="flex items-center gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
