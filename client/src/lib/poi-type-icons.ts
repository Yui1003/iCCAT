import type { CustomPoiType } from "@shared/schema";

import buildingIcon from '@assets/generated_images/Building_icon_green_background_3206ffb3.png';
import kioskIcon from '@assets/generated_images/You_are_Here_location_icon_294f7572.png';
import gateIcon from '@assets/generated_images/Gate_entrance_icon_green_b8dfb5ed.png';
import canteenIcon from '@assets/generated_images/Canteen_dining_icon_green_8cdb8c87.png';
import foodStallIcon from '@assets/generated_images/Food_stall_cart_icon_117edf54.png';
import libraryIcon from '@assets/generated_images/Library_books_icon_green_8639e524.png';
import studentLoungeIcon from '@assets/generated_images/Student_lounge_sofa_icon_91f45151.png';
import carParkingIcon from '@assets/generated_images/Car_parking_icon_green_15c240c8.png';
import motorcycleParkingIcon from '@assets/generated_images/Motorcycle_parking_icon_green_58dd1569.png';
import comfortRoomIcon from '@assets/generated_images/Restroom_comfort_room_icon_6cad7368.png';
import lectureHallIcon from '@assets/generated_images/Lecture_hall_classroom_icon_6a8a28ad.png';
import adminOfficeIcon from '@assets/generated_images/Administrative_office_briefcase_icon_1a31163b.png';
import dormitoryIcon from '@assets/generated_images/Dormitory_residence_hall_icon_0b08552a.png';
import clinicIcon from '@assets/generated_images/Health_clinic_medical_cross_2e3bb4e2.png';
import gymIcon from '@assets/generated_images/Gym_sports_dumbbell_icon_5be0961e.png';
import auditoriumIcon from '@assets/generated_images/Auditorium_theater_stage_icon_2f744312.png';
import laboratoryIcon from '@assets/generated_images/Laboratory_flask_test_tube_60e02462.png';
import facultyLoungeIcon from '@assets/generated_images/Faculty_lounge_coffee_mug_cc34405d.png';
import studyAreaIcon from '@assets/generated_images/Study_area_desk_lamp_de2acdc7.png';
import bookstoreIcon from '@assets/generated_images/Bookstore_book_price_tag_83e37414.png';
import atmIcon from '@assets/generated_images/ATM_cash_machine_icon_848adad9.png';
import chapelIcon from '@assets/generated_images/Chapel_prayer_room_cross_76e35c33.png';
import greenSpaceIcon from '@assets/generated_images/Green_space_tree_courtyard_d57ea32f.png';
import busStopIcon from '@assets/generated_images/Bus_stop_shuttle_icon_f080cef5.png';
import bikeParkingIcon from '@assets/generated_images/Bike_parking_bicycle_icon_9b6db414.png';
import securityOfficeIcon from '@assets/generated_images/Security_office_shield_badge_a19124a2.png';
import wasteStationIcon from '@assets/generated_images/Waste_recycling_station_icon_81c2fdf4.png';
import waterFountainIcon from '@assets/generated_images/Water_fountain_drinking_icon_690799ab.png';
import printCenterIcon from '@assets/generated_images/Print_copy_center_printer_7c56d319.png';
import otherIcon from '@assets/generated_images/Other_generic_question_mark_40bcf8cf.png';

export { otherIcon };

export const BUILTIN_ICON_MAP: Record<string, string> = {
  'Building': buildingIcon,
  'Gate': gateIcon,
  'Canteen': canteenIcon,
  'Food Stall': foodStallIcon,
  'Library': libraryIcon,
  'Student Lounge': studentLoungeIcon,
  'Car Parking': carParkingIcon,
  'Motorcycle Parking': motorcycleParkingIcon,
  'Comfort Room': comfortRoomIcon,
  'Lecture Hall / Classroom': lectureHallIcon,
  'Administrative Office': adminOfficeIcon,
  'Residence Hall / Dormitory': dormitoryIcon,
  'Health Services / Clinic': clinicIcon,
  'Gym / Sports Facility': gymIcon,
  'Auditorium / Theater': auditoriumIcon,
  'Laboratory': laboratoryIcon,
  'Faculty Lounge / Staff Room': facultyLoungeIcon,
  'Study Area': studyAreaIcon,
  'Bookstore': bookstoreIcon,
  'ATM': atmIcon,
  'Chapel / Prayer Room': chapelIcon,
  'Green Space / Courtyard': greenSpaceIcon,
  'Bus Stop / Shuttle Stop': busStopIcon,
  'Bike Parking': bikeParkingIcon,
  'Security Office / Campus Police': securityOfficeIcon,
  'Waste / Recycling Station': wasteStationIcon,
  'Water Fountain': waterFountainIcon,
  'Kiosk': kioskIcon,
  'Print/Copy Center': printCenterIcon,
  'Other': otherIcon,
};

/**
 * Build a reverse-rename map: displayName → originalName
 */
export function buildReverseRenames(renames: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(renames).map(([orig, disp]) => [disp, orig]));
}

/**
 * Resolves the display icon URL for a POI type.
 * Priority: custom type icon > icon override > built-in icon > otherIcon fallback
 * Handles renamed types by reverse-mapping display names back to original names for icon lookup.
 */
export function getPoiTypeIconUrl(
  poiType?: string | null,
  iconOverrides?: Record<string, string>,
  customTypes?: CustomPoiType[],
  renames?: Record<string, string>
): string {
  if (!poiType) return buildingIcon;

  // 1. Custom type — matched by display name directly
  const customType = customTypes?.find(c => c.name === poiType);
  if (customType?.icon) return customType.icon;

  // Build reverse rename map to resolve display name → original name
  const reverseRenames = renames ? buildReverseRenames(renames) : {};
  const originalName = reverseRenames[poiType] ?? poiType;

  // 2. Icon override — try exact name first, then original name
  if (iconOverrides?.[poiType]) return iconOverrides[poiType];
  if (originalName !== poiType && iconOverrides?.[originalName]) return iconOverrides[originalName];

  // 3. Built-in icon map — try exact name first, then original name
  if (BUILTIN_ICON_MAP[poiType]) return BUILTIN_ICON_MAP[poiType];
  if (originalName !== poiType && BUILTIN_ICON_MAP[originalName]) return BUILTIN_ICON_MAP[originalName];

  // 4. Fallback
  return otherIcon;
}
