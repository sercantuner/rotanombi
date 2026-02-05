 // Filter Side Panel - Sağ tarafta gizlenebilir filtre paneli
 import React, { useState, useEffect } from 'react';
 import { Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { GlobalFilterBar } from './GlobalFilterBar';
 import { useGlobalFilters } from '@/contexts/GlobalFilterContext';
 import { cn } from '@/lib/utils';
 
 interface FilterSidePanelProps {
   className?: string;
 }
 
 export function FilterSidePanel({ className }: FilterSidePanelProps) {
   const { activeFilterCount, crossFilter } = useGlobalFilters();
   
   // Panel açık/kapalı durumu - localStorage'dan başlat, varsayılan kapalı
   const [isOpen, setIsOpen] = useState(() => {
     const stored = localStorage.getItem('filterSidePanelOpen');
     return stored === 'true'; // Varsayılan kapalı
   });
   
   // Değişiklikleri localStorage'a kaydet
   useEffect(() => {
     localStorage.setItem('filterSidePanelOpen', String(isOpen));
   }, [isOpen]);
 
   const totalActiveFilters = activeFilterCount + (crossFilter ? 1 : 0);
 
   return (
     <>
       {/* Trigger Button - Sağ kenarda sabit */}
       <div
         className={cn(
           'fixed right-0 top-1/2 -translate-y-1/2 z-40 transition-all duration-300',
           isOpen ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
         )}
       >
         <Button
           variant="secondary"
           size="sm"
           onClick={() => setIsOpen(true)}
           className="rounded-l-lg rounded-r-none h-auto py-3 px-2 shadow-lg border-r-0 flex flex-col items-center gap-1.5"
         >
           <Filter className="w-4 h-4" />
           <span className="text-[10px] font-medium writing-mode-vertical">Filtreler</span>
           {totalActiveFilters > 0 && (
             <Badge 
               variant="default" 
               className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full"
             >
               {totalActiveFilters}
             </Badge>
           )}
         </Button>
       </div>
 
       {/* Overlay */}
       {isOpen && (
         <div 
           className="fixed inset-0 bg-background/50 backdrop-blur-sm z-40 lg:hidden"
           onClick={() => setIsOpen(false)}
         />
       )}
 
       {/* Side Panel */}
       <div
         className={cn(
           'fixed right-0 top-0 h-full z-50 transition-transform duration-300 ease-in-out',
           'w-80 md:w-96 bg-background border-l shadow-xl',
           isOpen ? 'translate-x-0' : 'translate-x-full',
           className
         )}
       >
         {/* Panel Header */}
         <div className="flex items-center justify-between p-4 border-b">
           <div className="flex items-center gap-2">
             <Filter className="w-5 h-5 text-primary" />
             <h2 className="font-semibold">Filtreler</h2>
             {totalActiveFilters > 0 && (
               <Badge variant="secondary" className="ml-1">
                 {totalActiveFilters} aktif
               </Badge>
             )}
           </div>
           <Button
             variant="ghost"
             size="icon"
             onClick={() => setIsOpen(false)}
             className="h-8 w-8"
           >
             <X className="w-4 h-4" />
           </Button>
         </div>
 
         {/* Panel Content - GlobalFilterBar içeriği */}
         <div className="p-4 overflow-y-auto h-[calc(100%-65px)]">
           <GlobalFilterBar 
             showDateFilter={true}
             compact={false}
             sidePanelMode={true}
           />
         </div>
       </div>
     </>
   );
 }