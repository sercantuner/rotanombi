 // Unified Notification Center - Tüm bildirimleri tek butonda toplar
 import React, { useState } from 'react';
 import { Bell, AlertTriangle, AlertCircle, Info, Check, Trash2, X, Sparkles, Package, ArrowUpCircle, MessageSquare } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import {
   Popover,
   PopoverContent,
   PopoverTrigger,
 } from '@/components/ui/popover';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { useNotifications, Notification } from '@/hooks/useNotifications';
 import { useWidgetUpdates } from '@/hooks/useWidgetUpdates';
 import { useNavigate } from 'react-router-dom';
 import { formatDistanceToNow } from 'date-fns';
 import { tr } from 'date-fns/locale';
 import { cn } from '@/lib/utils';
 
 const typeIcons = {
   critical: AlertTriangle,
   warning: AlertCircle,
   info: Info,
 };
 
 const typeColors = {
   critical: 'text-destructive bg-destructive/10',
   warning: 'text-yellow-500 bg-yellow-500/10',
   info: 'text-blue-500 bg-blue-500/10',
 };
 
 interface NotificationItemProps {
   notification: Notification;
   onRead: (id: string) => void;
   onDelete: (id: string) => void;
   onClick: () => void;
 }
 
 function NotificationItem({ notification, onRead, onDelete, onClick }: NotificationItemProps) {
   const Icon = typeIcons[notification.type] || Info;
   const colorClass = typeColors[notification.type] || typeColors.info;
 
   const handleClick = () => {
     if (!notification.is_read) {
       onRead(notification.id);
     }
     onClick();
   };
 
   return (
     <div 
       className={cn(
         "p-3 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors",
         !notification.is_read && "bg-muted/30"
       )}
       onClick={handleClick}
     >
       <div className="flex items-start gap-3">
         <div className={cn("p-2 rounded-full", colorClass)}>
           <Icon className="w-4 h-4" />
         </div>
         <div className="flex-1 min-w-0">
           <div className="flex items-center justify-between gap-2">
             <p className="font-medium text-sm truncate">{notification.title}</p>
             <Button
               variant="ghost"
               size="icon"
               className="h-6 w-6 shrink-0"
               onClick={(e) => {
                 e.stopPropagation();
                 onDelete(notification.id);
               }}
             >
               <X className="w-3 h-3" />
             </Button>
           </div>
           <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
             {notification.message}
           </p>
           <p className="text-xs text-muted-foreground mt-1">
             {formatDistanceToNow(new Date(notification.created_at), { 
               addSuffix: true, 
               locale: tr 
             })}
           </p>
         </div>
         {!notification.is_read && (
           <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
         )}
       </div>
     </div>
   );
 }
 
 export function UnifiedNotificationCenter() {
   const navigate = useNavigate();
   const [open, setOpen] = useState(false);
   const [activeTab, setActiveTab] = useState('notifications');
   
   // Bildirimler
   const { 
     notifications, 
     unreadCount: notificationUnreadCount, 
     loading: notificationsLoading,
     markAsRead, 
     markAllAsRead, 
     deleteNotification,
     clearAll 
   } = useNotifications();
 
   // Widget güncellemeleri
   const { updates, loading: updatesLoading, hasNewUpdates, markAsSeen } = useWidgetUpdates();
 
   const handleOpen = (isOpen: boolean) => {
     setOpen(isOpen);
     if (isOpen && hasNewUpdates && activeTab === 'updates') {
       markAsSeen();
     }
   };
 
   const handleTabChange = (tab: string) => {
     setActiveTab(tab);
     if (tab === 'updates' && hasNewUpdates) {
       markAsSeen();
     }
   };
 
   const handleNotificationClick = (notification: Notification) => {
     if (notification.link) {
       navigate(notification.link);
     }
     setOpen(false);
   };
 
   // Toplam okunmamış sayısı
   const totalUnread = notificationUnreadCount + (hasNewUpdates ? 1 : 0);
 
   return (
     <Popover open={open} onOpenChange={handleOpen}>
       <PopoverTrigger asChild>
         <Button variant="ghost" size="icon" className="relative">
           <Bell className="w-5 h-5" />
           {totalUnread > 0 && (
             <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
               {totalUnread > 9 ? '9+' : totalUnread}
             </span>
           )}
         </Button>
       </PopoverTrigger>
       <PopoverContent className="w-96 p-0" align="end">
         <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
           <div className="border-b border-border">
             <TabsList className="w-full h-auto p-1 bg-transparent gap-1">
               <TabsTrigger 
                 value="notifications" 
                 className="flex-1 gap-2 data-[state=active]:bg-muted"
               >
                 <Bell className="w-4 h-4" />
                 <span>Bildirimler</span>
                 {notificationUnreadCount > 0 && (
                   <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                     {notificationUnreadCount}
                   </Badge>
                 )}
               </TabsTrigger>
               <TabsTrigger 
                 value="updates" 
                 className="flex-1 gap-2 data-[state=active]:bg-muted"
               >
                 <Sparkles className="w-4 h-4" />
                 <span>Yenilikler</span>
                 {hasNewUpdates && (
                   <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                 )}
               </TabsTrigger>
             </TabsList>
           </div>
           
           {/* Bildirimler Tab */}
           <TabsContent value="notifications" className="m-0">
             {notificationUnreadCount > 0 && (
               <div className="flex items-center justify-end p-2 border-b border-border">
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   className="h-7 text-xs"
                   onClick={markAllAsRead}
                 >
                   <Check className="w-3 h-3 mr-1" />
                   Tümünü Okundu İşaretle
                 </Button>
               </div>
             )}
             
             <ScrollArea className="h-80">
               {notificationsLoading ? (
                 <div className="flex items-center justify-center h-32 text-muted-foreground">
                   Yükleniyor...
                 </div>
               ) : notifications.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                   <Bell className="w-8 h-8 mb-2 opacity-50" />
                   <p className="text-sm">Bildirim yok</p>
                 </div>
               ) : (
                 notifications.map((notification) => (
                   <NotificationItem
                     key={notification.id}
                     notification={notification}
                     onRead={markAsRead}
                     onDelete={deleteNotification}
                     onClick={() => handleNotificationClick(notification)}
                   />
                 ))
               )}
             </ScrollArea>
 
             {notifications.length > 0 && (
               <div className="p-2 border-t border-border">
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   className="w-full text-xs text-muted-foreground hover:text-destructive"
                   onClick={clearAll}
                 >
                   <Trash2 className="w-3 h-3 mr-1" />
                   Tümünü Temizle
                 </Button>
               </div>
             )}
           </TabsContent>
 
           {/* Yenilikler Tab */}
           <TabsContent value="updates" className="m-0">
             <div className="p-3 border-b border-border">
               <p className="text-xs text-muted-foreground">
                 Yeni eklenen ve güncellenen widget'lar
               </p>
             </div>
             
             <ScrollArea className="h-80">
               {updatesLoading ? (
                 <div className="flex items-center justify-center h-32 text-muted-foreground">
                   Yükleniyor...
                 </div>
               ) : updates.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                   <Sparkles className="w-8 h-8 mb-2 opacity-50" />
                   <p className="text-sm">Henüz güncelleme yok</p>
                 </div>
               ) : (
                 <div className="p-2 space-y-1">
                   {updates.map((update) => (
                     <div
                       key={update.id}
                       className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                     >
                       <div className="flex items-start gap-2">
                         <div className={cn(
                           "mt-0.5 p-1.5 rounded-full",
                           update.change_type === 'created' 
                             ? "bg-green-500/10 text-green-600" 
                             : "bg-blue-500/10 text-blue-600"
                         )}>
                           {update.change_type === 'created' ? (
                             <Sparkles className="h-3 w-3" />
                           ) : (
                             <ArrowUpCircle className="h-3 w-3" />
                           )}
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2">
                             <span className="font-medium text-sm truncate">
                               {update.widget_name}
                             </span>
                             <Badge variant="outline" className="text-xs shrink-0">
                               v{update.version}
                             </Badge>
                           </div>
                           <p className="text-xs text-muted-foreground mt-0.5">
                             {update.change_type === 'created' ? 'Yeni eklendi' : 'Güncellendi'}
                             {' • '}
                             {formatDistanceToNow(new Date(update.created_at), {
                               addSuffix: true,
                               locale: tr,
                             })}
                           </p>
                           {update.change_notes && (
                             <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                               {update.change_notes}
                             </p>
                           )}
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </ScrollArea>
           </TabsContent>
         </Tabs>
       </PopoverContent>
     </Popover>
   );
 }