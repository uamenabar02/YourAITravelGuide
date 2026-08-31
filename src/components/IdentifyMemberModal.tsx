import React, { useState, useEffect } from "react";
import {
  ItineraryPlan,
  GroupCollaborationState,
  GroupMemberProfile,
} from "../types";
import {
  Users,
  X,
  CheckCircle2,
  Lock,
  Sparkles,
  Shield,
  UserCheck,
  Crown,
  Edit3,
  Eye,
  LogIn,
  AlertCircle,
} from "lucide-react";
import { claimMemberIdentity, subscribeToSharedTrip } from "../utils/sharedTripService";
import { getAvatarColor } from "../utils/formatters";
import { useAuth } from "../context/AuthContext";
import { TranslatedText } from "./TranslatedText";

interface IdentifyMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: ItineraryPlan;
  collabState: GroupCollaborationState;
  userEmail?: string;
  userName?: string;
  onClaimSuccess: (memberName: string, updatedCollab: GroupCollaborationState) => void;
  onShowToast?: (msg: string, type?: "success" | "info" | "error") => void;
}

export const IdentifyMemberModal: React.FC<IdentifyMemberModalProps> = ({
  isOpen,
  onClose,
  plan,
  collabState,
  userEmail,
  userName,
  onClaimSuccess,
  onShowToast,
}) => {
  const { user, activeEmail, signInWithGoogle } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCollab, setActiveCollab] = useState<GroupCollaborationState>(collabState);

  useEffect(() => {
    setActiveCollab(collabState);
  }, [collabState]);

  useEffect(() => {
    if (!plan?.id) return;
    const unsubscribe = subscribeToSharedTrip(plan.id, (sharedDoc) => {
      if (sharedDoc && sharedDoc.collabState) {
        setActiveCollab(sharedDoc.collabState);
      }
    });
    return () => unsubscribe();
  }, [plan?.id]);

  if (!isOpen) return null;

  const currentEmail = (userEmail || activeEmail || user?.email || "").toLowerCase();
  const profiles: GroupMemberProfile[] =
    activeCollab.memberProfiles && activeCollab.memberProfiles.length > 0
      ? activeCollab.memberProfiles
      : activeCollab.members.map((m, idx) => ({
          id: `m-${idx}`,
          name: m,
          role: idx === 0 ? "organizer" : "editor",
          joinedAt: Date.now(),
        }));

  const handleClaim = async (memberName: string) => {
    if (!currentEmail) {
      onShowToast?.("Please sign in with Google first to identify yourself.", "info");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await claimMemberIdentity(
        plan.id,
        memberName,
        currentEmail,
        userName || user?.displayName || currentEmail.split("@")[0]
      );

      if (res.success && res.updatedCollab) {
        onShowToast?.(res.message || `Identified as ${memberName}!`, "success");
        onClaimSuccess(memberName, res.updatedCollab);
        onClose();
      } else {
        onShowToast?.(res.message || "Failed to identify.", "error");
      }
    } catch (err: any) {
      onShowToast?.(err.message || "Error claiming identity.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignInAndRetry = async () => {
    try {
      await signInWithGoogle();
      onShowToast?.("Signed in with Google! Now select your member identity.", "success");
    } catch (err: any) {
      onShowToast?.("Google Sign-In failed: " + err.message, "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-20 select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl border border-[#e5e5df] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-[#2c2c24] text-white flex items-center justify-between border-b border-[#3a3a30]">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#5A5A40] flex items-center justify-center text-white shrink-0 shadow-xs">
              <UserCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif text-lg sm:text-xl font-bold italic text-white truncate">
                <TranslatedText text="Join Trip Collaboration" />
              </h3>
              <p className="text-xs text-[#d1d1ca] font-sans truncate">
                {plan.destinationOrTown} • <TranslatedText text="Identify who you are in this group" />
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#a8a89f] hover:text-white rounded-full hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 bg-[#fafaf7] flex-1">
          {/* Account status badge */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] flex items-center justify-between gap-3 shadow-3xs">
            <div className="min-w-0">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#8a8a7e]">
                <TranslatedText text="Connected Account" />
              </span>
              <p className="text-xs font-semibold text-[#2c2c24] truncate">
                {currentEmail ? currentEmail : <TranslatedText text="Not signed in yet" />}
              </p>
            </div>
            {!currentEmail && (
              <button
                type="button"
                onClick={handleGoogleSignInAndRetry}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#5A5A40] text-white rounded-xl text-xs font-serif italic hover:bg-[#4a4a35] transition-colors shrink-0 shadow-2xs cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span><TranslatedText text="Sign in with Google" /></span>
              </button>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-serif italic font-bold text-sm text-[#2c2c24] flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-[#5A5A40]" />
                <span><TranslatedText text="Select Your Group Member Slot:" /></span>
              </h4>
              <span className="text-[11px] text-[#8a8a7e]">
                {profiles.length} <TranslatedText text={`member${profiles.length !== 1 ? "s" : ""} defined`} />
              </span>
            </div>
            <p className="text-xs text-[#6b6b5e] mb-3">
              <TranslatedText text="The organizer created these member slots. Select your name to gain Contributor or Organizer access." />
            </p>

            {/* Member List */}
            <div className="space-y-2.5">
              {profiles.map((profile) => {
                const isClaimedByMe =
                  currentEmail &&
                  profile.claimedByEmail &&
                  profile.claimedByEmail.toLowerCase() === currentEmail.toLowerCase();
                const isClaimedByOther =
                  profile.claimedByEmail &&
                  (!currentEmail || profile.claimedByEmail.toLowerCase() !== currentEmail.toLowerCase());

                const roleBadge = (
                  <span
                    className={`text-[10px] font-sans px-2 py-0.5 rounded-full border shrink-0 ${
                      profile.role === "organizer"
                        ? "bg-amber-50 text-amber-900 border-amber-200"
                        : profile.role === "viewer"
                        ? "bg-stone-50 text-stone-700 border-stone-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    }`}
                  >
                    {profile.role === "organizer" ? (
                      <>👑 <TranslatedText text="Organizer" /></>
                    ) : profile.role === "viewer" ? (
                      <>👁️ <TranslatedText text="Viewer" /></>
                    ) : (
                      <>✏️ <TranslatedText text="Contributor" /></>
                    )}
                  </span>
                );

                return (
                  <div
                    key={profile.id || profile.name}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isClaimedByMe
                        ? "bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/40"
                        : isClaimedByOther
                        ? "bg-[#ecece4]/60 border-[#d1d1ca] opacity-75"
                        : "bg-white border-[#e5e5df] hover:border-[#5A5A40] hover:shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${getAvatarColor(
                          profile.name
                        )}`}
                      >
                        {profile.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="font-bold text-[#2c2c24] text-sm truncate">
                            {profile.name}
                          </span>
                          {roleBadge}
                        </div>
                        {isClaimedByMe ? (
                          <span className="text-[11px] text-emerald-700 font-medium flex items-center space-x-1 mt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span><TranslatedText text={`Linked to your account (${currentEmail})`} /></span>
                          </span>
                        ) : isClaimedByOther ? (
                          <span className="text-[11px] text-stone-500 flex items-center space-x-1 mt-0.5 truncate">
                            <Lock className="w-3 h-3 shrink-0" />
                            <span className="truncate"><TranslatedText text={`Claimed by ${profile.claimedByEmail}`} /></span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#8a8a7e] mt-0.5 block">
                            <TranslatedText text="Available to claim" />
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isClaimedByMe ? (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-serif italic shadow-3xs flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span><TranslatedText text="Active" /></span>
                        </span>
                      ) : isClaimedByOther ? (
                        <span className="px-3 py-1.5 rounded-xl bg-[#d1d1ca] text-stone-600 text-xs font-serif italic cursor-not-allowed">
                          <TranslatedText text="Locked" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isSubmitting || !currentEmail}
                          onClick={() => handleClaim(profile.name)}
                          className="px-3.5 py-1.5 bg-[#5A5A40] text-white rounded-xl text-xs font-serif italic hover:bg-[#4a4a35] transition-colors disabled:opacity-40 shadow-2xs cursor-pointer"
                        >
                          <TranslatedText text={`I am ${profile.name}`} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Roster explanation */}
          <div className="bg-[#f0f0ea] p-3.5 rounded-2xl border border-[#d1d1ca] text-xs text-[#525246] space-y-1.5">
            <div className="flex items-center space-x-1.5 font-bold text-[#2c2c24]">
              <AlertCircle className="w-4 h-4 text-[#5A5A40]" />
              <span><TranslatedText text="Identity & Permission Rules:" /></span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#6b6b5e]">
              <li><TranslatedText text="Once you identify as a member, no other account can claim that same member name." /></li>
              <li>
                <TranslatedText text="Organizers & Contributors can edit the itinerary, group expenses, packing list, and offline pocket in real time." />
              </li>
              <li>
                <TranslatedText text="The Organizer can modify roles, reassign accounts, or unlink members at any time in Group Hub." />
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[#6b6b5e] hover:bg-[#ecece4] font-serif italic transition-colors cursor-pointer"
          >
            <TranslatedText text="Continue as Viewer" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#5A5A40] text-white font-serif italic hover:bg-[#4a4a35] transition-colors shadow-2xs cursor-pointer"
          >
            <TranslatedText text="Done" />
          </button>
        </div>
      </div>
    </div>
  );
};
