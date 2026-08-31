import React, { useState, useEffect } from "react";
import { Users, X, ExternalLink, ShieldCheck, UserCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { CreatorProfileModal } from "./CreatorProfileModal";

interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatar: string;
  status: "editing" | "viewing" | "idle";
  color: string;
  role: string;
  isMember: boolean;
}

export const CollaboratorPresence: React.FC = () => {
  const { user, profile } = useAuth();
  const [isOpenModal, setIsOpenModal] = useState<boolean>(false);
  const [selectedCreatorEmail, setSelectedCreatorEmail] = useState<string | null>(null);

  // We check if the current user is signed in and authorized as a trip member or if they are an outside reader
  const isOwnerOrMember = !!user; // If logged in, they are considered owner/member of this instance; otherwise outside reader.

  const [collaborators, setCollaborators] = useState<Collaborator[]>([
    {
      id: "c1",
      name: "Sarah Miller",
      email: "sarah.miller@example.com",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces",
      status: "editing",
      color: "bg-emerald-500",
      role: "Co-Organizer",
      isMember: true,
    },
    {
      id: "c2",
      name: "Alex Thorne",
      email: "alex.thorne@example.com",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
      status: "viewing",
      color: "bg-amber-500",
      role: "Outside Reader", // if they joined via link without edit permissions
      isMember: false,
    },
  ]);

  // Periodically simulate activity status changes
  useEffect(() => {
    const timer = setInterval(() => {
      setCollaborators((prev) =>
        prev.map((c) => ({
          ...c,
          status: Math.random() > 0.5 ? "editing" : "viewing",
        }))
      );
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const totalActiveCount = 1 + collaborators.filter((c) => c.status !== "idle").length;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpenModal(true)}
        className="flex items-center space-x-2 bg-white/95 hover:bg-[#ecece4]/80 px-3 py-1.5 rounded-2xl border border-[#e5e5df] hover:border-[#d1d1ca] shadow-3xs no-print cursor-pointer transition-all"
        title="Click to view active partners and profiles"
      >
        <div className="flex items-center -space-x-2 overflow-hidden">
          {user && (
            <div
              className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-[#5A5A40] text-white flex items-center justify-center text-[10px] font-bold font-serif"
              title={`You (${profile?.name || user.email || "Explorer"})`}
            >
              {(profile?.name || user.email || "U").charAt(0).toUpperCase()}
            </div>
          )}
          {collaborators.map((c) => (
            <div key={c.id} className="relative inline-block" title={`${c.name} (${c.role})`}>
              <img className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover" src={c.avatar} alt={c.name} />
              <span className={`absolute bottom-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white ${c.color}`} />
            </div>
          ))}
        </div>
        <div className="text-[11px] font-serif italic text-[#5A5A40] hidden sm:block whitespace-nowrap flex items-center space-x-1">
          <span>{totalActiveCount} active partners in trip</span>
        </div>
      </button>

      {/* Active Partners List & Profiles Modal */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-[#fafaf8] border border-[#d1d1ca] rounded-3xl max-w-lg w-full p-6 shadow-xl relative space-y-5">
            <button
              type="button"
              onClick={() => setIsOpenModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-[#ecece4] text-[#8a8a7e] hover:text-[#2c2c24] transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#ecece4] border border-[#d1d1ca] flex items-center justify-center text-[#5A5A40]">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-semibold italic text-[#2c2c24]">Active Trip Partners</h3>
                <p className="text-xs text-[#8a8a7e]">Explore collaborator profiles, live status, and member roles.</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Current User item */}
              {user ? (
                <div className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-[#5A5A40] text-white flex items-center justify-center font-serif font-bold text-sm">
                      {(profile?.name || user.email || "U").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-serif font-semibold text-[#2c2c24] text-sm flex items-center gap-1.5">
                        {profile?.name || user.email || "You"}
                        <span className="text-[10px] bg-[#ecece4] text-[#5A5A40] px-2 py-0.5 rounded-full font-sans font-medium">You</span>
                      </h4>
                      <p className="text-xs text-[#5A5A40] italic font-serif flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
                        Trip Owner &amp; Main Editor
                      </p>
                    </div>
                  </div>
                  <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-xl font-sans font-medium">
                    Active Now
                  </span>
                </div>
              ) : (
                <div className="bg-white p-3.5 rounded-2xl border border-amber-200 bg-amber-50/30 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-serif font-bold text-sm">
                      ?
                    </div>
                    <div>
                      <h4 className="font-serif font-semibold text-[#2c2c24] text-sm">You (Guest Viewer)</h4>
                      <p className="text-xs text-amber-800 italic font-serif">Outside Reader • Read-only access</p>
                    </div>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-xl font-sans font-medium">
                    Viewing
                  </span>
                </div>
              )}

              {/* Other Collaborators */}
              {collaborators.map((c) => {
                // If user is not logged in or viewing as guest, c2 is Outside Reader
                const displayRole = c.isMember ? c.role : "Outside Reader";
                return (
                  <div key={c.id} className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] flex items-center justify-between hover:border-[#5A5A40] transition-colors">
                    <div className="flex items-center space-x-3">
                      <img src={c.avatar} alt={c.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-[#ecece4]" />
                      <div>
                        <h4 className="font-serif font-semibold text-[#2c2c24] text-sm flex items-center gap-2">
                          {c.name}
                          {!c.isMember && (
                            <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-sans">
                              Guest Link
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-[#8a8a7e] italic font-serif">
                          <span className={c.isMember ? "text-[#5A5A40] font-medium" : "text-amber-700 font-medium"}>{displayRole}</span> • {c.status === "editing" ? "Currently editing" : "Viewing"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpenModal(false);
                        setSelectedCreatorEmail(c.email);
                      }}
                      className="px-3 py-1.5 bg-[#ecece4] hover:bg-[#5A5A40] hover:text-white text-[#2c2c24] text-xs font-serif italic rounded-xl border border-[#d1d1ca] transition-all cursor-pointer flex items-center space-x-1"
                    >
                      <span>View Profile</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-[#e5e5df] flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpenModal(false)}
                className="px-5 py-2 bg-[#2c2c24] text-white rounded-xl text-xs font-serif italic hover:bg-[#5A5A40] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creator Profile Modal if a collaborator's profile is clicked */}
      {selectedCreatorEmail && (
        <CreatorProfileModal
          isOpen={!!selectedCreatorEmail}
          onClose={() => setSelectedCreatorEmail(null)}
          creatorEmail={selectedCreatorEmail}
        />
      )}
    </>
  );
};
