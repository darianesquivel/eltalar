export const getHours = (business:any) => {
    const days = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
  
    const today = new Date().getDay();
  
    const hours = days.map((label, index) => {
      const dayHours =
        business.business_hours?.filter((x: any) => x.day_of_week === index) ??
        [];
  
      if (dayHours.length === 0) {
        return {
          label,
          isToday: index === today,
          status: "not_loaded",
        };
      }
  
      if (dayHours.some((h: any) => h.is_closed)) {
        return {
          label,
          isToday: index === today,
          status: "closed",
        };
      }
  
      const ranges = dayHours
        .filter((h: any) => h.open_time && h.close_time)
        .map((h: any) => ({
          open: h.open_time.slice(0, 5),
          close: h.close_time.slice(0, 5),
        }));
  
      return {
        label,
        isToday: index === today,
        status: "open",
        ranges,
      };
    });
  
    return hours;
  };