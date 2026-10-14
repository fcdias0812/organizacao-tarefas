import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      gap={8}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-brand-600" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-danger" />,
        loading: <Loader2Icon className="size-4 animate-spin text-ink-3" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "rounded-2xl! border-0! bg-surface! px-4! py-3! shadow-pop! font-sans! text-[13px]! text-ink! gap-2.5!",
          description: "text-ink-3!",
          actionButton: "rounded-full! bg-brand-600! px-3! font-medium!",
          cancelButton: "rounded-full!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
