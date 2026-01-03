import { useState } from "react";
import { Plus, Edit2, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CustomerRole } from "./types";
import { useToast } from "@/hooks/use-toast";

interface CustomerRolesManagerProps {
  roles: CustomerRole[];
  onCreateRole: (role: Omit<CustomerRole, "id" | "created_at">) => void;
  onUpdateRole: (role: CustomerRole) => void;
  onDeleteRole: (roleId: string) => void;
  storeId: string;
}

export function CustomerRolesManager({
  roles,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
  storeId,
}: CustomerRolesManagerProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomerRole | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sort_order: 0,
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", sort_order: 0 });
    setEditingRole(null);
  };

  const handleOpenDialog = (role?: CustomerRole) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        description: role.description || "",
        sort_order: role.sort_order,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название роли",
        variant: "destructive",
      });
      return;
    }

    if (editingRole) {
      onUpdateRole({
        ...editingRole,
        name: formData.name,
        description: formData.description || undefined,
        sort_order: formData.sort_order,
      });
      toast({
        title: "Роль обновлена",
        description: `Роль "${formData.name}" успешно обновлена`,
      });
    } else {
      onCreateRole({
        store_id: storeId,
        name: formData.name,
        description: formData.description || undefined,
        sort_order: formData.sort_order,
      });
      toast({
        title: "Роль создана",
        description: `Роль "${formData.name}" успешно создана`,
      });
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = (role: CustomerRole) => {
    if (confirm(`Удалить роль "${role.name}"?`)) {
      onDeleteRole(role.id);
      toast({
        title: "Роль удалена",
        description: `Роль "${role.name}" удалена`,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Роли клиентов</h2>
          <p className="text-sm text-muted-foreground">
            Создавайте роли для гибкого ценообразования (Оптовик, Розница, VIP и т.д.)
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить роль
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRole ? "Редактировать роль" : "Новая роль клиента"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Название *</Label>
                <Input
                  placeholder="Например: Оптовик"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  placeholder="Описание роли..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Порядок сортировки</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={handleSave}>
                  {editingRole ? "Сохранить" : "Создать"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {roles.length > 0 ? (
        <div className="bg-card rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Описание</TableHead>
                <TableHead className="w-[100px]">Порядок</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {role.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {role.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{role.sort_order}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenDialog(role)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(role)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium text-foreground mb-2">Нет ролей клиентов</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Создайте роли для настройки индивидуальных цен разным группам покупателей
          </p>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Создать первую роль
          </Button>
        </div>
      )}
    </div>
  );
}
