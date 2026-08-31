import React from "react";
import { TravelBookingPass, ItineraryPlan } from "../types";
import { BookingPassForm } from "./BookingPassForm";

interface AddBookingPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pass: TravelBookingPass) => void;
  initialPass?: TravelBookingPass | null;
  tripPlan: ItineraryPlan;
  groupMembers?: string[];
}

export const AddBookingPassModal: React.FC<AddBookingPassModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPass,
  tripPlan,
  groupMembers,
}) => {
  return (
    <BookingPassForm
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
      initialPass={initialPass}
      tripPlan={tripPlan}
      groupMembers={groupMembers}
      isInline={false}
    />
  );
};
