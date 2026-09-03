import React, { useState, useEffect } from "react";
import {
  X,
  User,
  MapPin,
  Compass,
  Award,
  Globe,
  Star,
  Download,
  Plus,
  Check,
  Calendar,
  MessageSquare,
  Sparkles,
  Heart,
  Share2,
  ExternalLink,
  Tag,
  Eye,
} from "lucide-react";
import { PublicUserProfile, SharedTripDoc, CommunitySpotDoc, ItineraryPlan, ActivitySpot, ActivityCategory } from "../types";
import { getPublicUserProfile, getUserPublicTrips, getUserReviewsAcrossTrips } from "../utils/socialService";
import { fetchCommunitySpots } from "../utils/communitySpotService";
import { saveTrip } from "../utils/storage";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";
import { ItineraryPreviewModal } from "./ItineraryPreviewModal";
import { ActivityDetailModal } from "./ActivityDetailModal";

interface CreatorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorEmail: string;
  onSelectTrip?: (plan: ItineraryPlan) => void;
  onImportSpot?: (spot: CommunitySpotDoc) => void;
  onShowToast?: (msg: string, type?: "success" | "info" | "error") => void;
}

export const CreatorProfileModal: React.FC<CreatorProfileModalProps> = ({
  isOpen,
  onClose,
  creatorEmail,
  onSelectTrip,
  onImportSpot,
  onShowToast,
}) => {
  const { t } = useLanguage();
  const { profile, activeEmail, toggleFollowUser } = useAuth();

  const [creatorProfile, setCreatorProfile] = useState<PublicUserProfile | null>(null);
  const [publicTrips, setPublicTrips] = useState<SharedTripDoc[]>([]);
  const [publicSpots, setPublicSpots] = useState<CommunitySpotDoc[]>([]);
  const [userReviews, setUserReviews] = useState<
    Array<{ tripId: string; tripTitle: string; destination: string; rating: number; text: string; createdAt: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"itineraries" | "spots" | "reviews">("itineraries");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  // Modals for Itinerary Preview & Spot Details inside Creator Profile
  const [previewTrip, setPreviewTrip] = useState<SharedTripDoc | null>(null);
  const [selectedSpotForGuide, setSelectedSpotForGuide] = useState<{
    spot: ActivitySpot;
    destination: string;
    dayNumber?: number;
  } | null>(null);

  const cleanCreatorEmail = (creatorEmail || "").trim().toLowerCase();
  const myEmail = (activeEmail || profile?.email || "").trim().toLowerCase();
  const isMe = cleanCreatorEmail === myEmail;

  // Helper to convert CommunitySpotDoc to ActivitySpot
  const communitySpotToActivitySpot = (spot: CommunitySpotDoc): ActivitySpot => {
    return {
      id: spot.id,
      name: spot.name,
      time: "Flexible",
      address: spot.neighborhood
        ? `${spot.neighborhood}, ${spot.cityOrRegion}`
        : spot.cityOrRegion,
      description: spot.description,
      insiderTip: spot.insiderTip || "",
      approxCost: spot.approxCost || "Free",
      durationMinutes: spot.durationMinutes || 90,
      category: (spot.category as ActivityCategory) || "hidden-gem",
      coordinates: spot.coordinates || { lat: 43.3183, lng: -1.9812 },
      photos: spot.photos || (spot.imageUrl ? [spot.imageUrl] : []),
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        spot.name + " " + spot.cityOrRegion
      )}`,
      tags: spot.tags || (spot.category ? [spot.category] : []),
      rating: spot.rating || 5.0,
    };
  };

  useEffect(() => {
    if (!isOpen || !cleanCreatorEmail) return;

    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const [prof, trips, allSpots, reviews] = await Promise.all([
          getPublicUserProfile(cleanCreatorEmail),
          getUserPublicTrips(cleanCreatorEmail),
          fetchCommunitySpots(),
          getUserReviewsAcrossTrips(cleanCreatorEmail),
        ]);

        if (!isMounted) return;

        setCreatorProfile(prof);
        setPublicTrips(trips);
        setPublicSpots(allSpots.filter((s) => s.creatorEmail?.toLowerCase() === cleanCreatorEmail));
        setUserReviews(reviews);

        const currentFollowingList: string[] = profile?.following || [];
        setIsFollowing(currentFollowingList.map((e) => e.toLowerCase()).includes(cleanCreatorEmail));

        const baseFollowers = prof?.followers ? prof.followers.length : 0;
        setFollowersCount(baseFollowers);
      } catch (err) {
        console.error("Failed to load creator profile:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 3000);

    loadData();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [isOpen, cleanCreatorEmail, profile?.following]);

  const handleToggleFollow = async () => {
    if (!cleanCreatorEmail || isMe) return;
    try {
      await toggleFollowUser(cleanCreatorEmail);
      setIsFollowing((prev) => !prev);
      setFollowersCount((prev) => (isFollowing ? Math.max(0, prev - 1) : prev + 1));
      if (onShowToast) {
        onShowToast(
          !isFollowing
            ? `Now following ${creatorProfile?.name || cleanCreatorEmail}!`
            : `Unfollowed ${creatorProfile?.name || cleanCreatorEmail}.`,
          "success"
        );
      }
    } catch (err) {
      console.error("Failed to toggle follow:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="creator-profile-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-stone-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Avatar & Details */}
        <div className="bg-white border-b border-[#e5e5df]/60 p-6 sm:p-8 text-[#2c2c24] relative">
          <button
            id="close-creator-profile-btn"
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f5f5f0] hover:bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#f5f5f0] border border-[#d1d1ca] text-[#5A5A40] font-bold text-2xl flex items-center justify-center shadow-xs">
                {creatorProfile?.name ? creatorProfile.name[0].toUpperCase() : "E"}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold font-serif tracking-tight text-[#2c2c24]">
                    {creatorProfile?.name || cleanCreatorEmail.split("@")[0]}
                  </h2>
                  {isMe && (
                    <span className="px-2 py-0.5 bg-[#5A5A40]/10 text-[#5A5A40] text-[10px] font-bold rounded-full uppercase tracking-wider border border-[#d1d1ca]">
                      <TranslatedText text="You" />
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#6b6b5e]">
                  {creatorProfile?.homeCity && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#5A5A40]" />
                      {creatorProfile.homeCity}
                    </span>
                  )}
                  {creatorProfile?.travelStyle && (
                    <span className="flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-[#5A5A40]" />
                      {creatorProfile.travelStyle}
                    </span>
                  )}
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(creatorProfile?.badges || ["Local Contributor"]).map((badge, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-[#f5f5f0] border border-[#d1d1ca] text-[#5A5A40] text-[10px] font-semibold rounded-md flex items-center gap-1"
                    >
                      <Award className="w-3 h-3 text-[#5A5A40]" />
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Action / Follow Button */}
            {!isMe && (
              <div className="flex items-center gap-2">
                <button
                  id="creator-profile-follow-btn"
                  onClick={handleToggleFollow}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm ${
                    isFollowing
                      ? "bg-white/20 text-white hover:bg-red-500/20 hover:text-red-200 border border-white/30"
                      : "bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold active:scale-95 shadow-emerald-700/20"
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <TranslatedText text="Following" />
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <TranslatedText text="Follow Explorer" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Bio & Social */}
          <div className="space-y-2 mt-4 pt-3 border-t border-[#e5e5df]/60">
            {creatorProfile?.bio ? (
              <p className="text-xs sm:text-sm text-[#6b6b5e] leading-relaxed max-w-2xl">{creatorProfile.bio}</p>
            ) : (
              <p className="text-xs text-[#8a8a7e] italic">
                <TranslatedText text="No bio provided yet." />
              </p>
            )}

            {creatorProfile?.websiteOrSocial && (
              <div className="flex items-center gap-2 text-xs text-[#5A5A40] font-medium">
                <Globe className="w-3.5 h-3.5" />
                <a
                  href={
                    creatorProfile.websiteOrSocial.startsWith("http")
                      ? creatorProfile.websiteOrSocial
                      : `https://${creatorProfile.websiteOrSocial}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1 text-[#5A5A40]"
                >
                  {creatorProfile.websiteOrSocial}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Community Stats Pills */}
          <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-[#e5e5df]/60">
            <div className="text-center p-2 rounded-xl bg-[#f5f5f0] border border-[#d1d1ca]/40">
              <div className="text-base sm:text-lg font-bold text-[#2c2c24]">{publicTrips.length}</div>
              <div className="text-[10px] text-[#6b6b5e] font-medium uppercase tracking-wider">
                <TranslatedText text="Itineraries" />
              </div>
            </div>
            <div className="text-center p-2 rounded-xl bg-[#f5f5f0] border border-[#d1d1ca]/40">
              <div className="text-base sm:text-lg font-bold text-[#2c2c24]">{publicSpots.length}</div>
              <div className="text-[10px] text-[#6b6b5e] font-medium uppercase tracking-wider">
                <TranslatedText text="Spots" />
              </div>
            </div>
            <div className="text-center p-2 rounded-xl bg-[#f5f5f0] border border-[#d1d1ca]/40">
              <div className="text-base sm:text-lg font-bold text-[#2c2c24]">{followersCount}</div>
              <div className="text-[10px] text-[#6b6b5e] font-medium uppercase tracking-wider">
                <TranslatedText text="Followers" />
              </div>
            </div>
            <div className="text-center p-2 rounded-xl bg-[#f5f5f0] border border-[#d1d1ca]/40">
              <div className="text-base sm:text-lg font-bold text-[#2c2c24]">{userReviews.length}</div>
              <div className="text-[10px] text-[#6b6b5e] font-medium uppercase tracking-wider">
                <TranslatedText text="Reviews" />
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#e5e5df]/60 bg-white px-6">
          <button
            id="tab-creator-itineraries"
            onClick={() => setActiveTab("itineraries")}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "itineraries"
                ? "border-[#5A5A40] text-[#5A5A40]"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Compass className="w-4 h-4" />
            <TranslatedText text="Public Itineraries" />
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-stone-100 text-stone-600">
              {publicTrips.length}
            </span>
          </button>
          <button
            id="tab-creator-spots"
            onClick={() => setActiveTab("spots")}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "spots"
                ? "border-[#5A5A40] text-[#5A5A40]"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <TranslatedText text="Shared Spots" />
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-stone-100 text-stone-600">
              {publicSpots.length}
            </span>
          </button>
          <button
            id="tab-creator-reviews"
            onClick={() => setActiveTab("reviews")}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "reviews"
                ? "border-[#5A5A40] text-[#5A5A40]"
                : "border-transparent text-[#6b6b5e] hover:text-[#2c2c24]"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <TranslatedText text="Reviews Given" />
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-stone-100 text-stone-600">
              {userReviews.length}
            </span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[440px] bg-stone-50/50">
          {loading ? (
            <div className="py-12 text-center text-stone-500 space-y-2">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium">
                <TranslatedText text="Loading creator portfolio..." />
              </p>
            </div>
          ) : (
            <>
              {/* Tab 1: Public Itineraries */}
              {activeTab === "itineraries" && (
                <div>
                  {publicTrips.length === 0 ? (
                    <div className="text-center py-10 px-4 bg-white rounded-2xl border border-dashed border-stone-200">
                      <Compass className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      <p className="text-stone-600 font-medium text-sm">
                        <TranslatedText text="No public itineraries published yet." />
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {publicTrips.map((trip) => (
                        <div
                          key={trip.id}
                          className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 hover:shadow-md transition-shadow flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h4 className="font-bold text-stone-900 text-base line-clamp-1">
                                {trip.plan.title}
                              </h4>
                              <div className="flex items-center gap-1 text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span>{trip.rating?.toFixed(1) || "5.0"}</span>
                              </div>
                            </div>
                            <p className="text-xs text-stone-600 line-clamp-2 mb-3">
                              {trip.plan.summary}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mb-3">
                              <span className="flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded-md">
                                <Calendar className="w-3 h-3 text-stone-400" />
                                {trip.plan.totalDays} <TranslatedText text="Days" />
                              </span>
                              <span className="flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded-md">
                                <MapPin className="w-3 h-3 text-stone-400" />
                                {trip.plan.destinationOrTown}
                              </span>
                              <span className="flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded-md">
                                <Download className="w-3 h-3 text-stone-400" />
                                {trip.downloadsCount || 0}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                            {/* Preview Button */}
                            <button
                              type="button"
                              onClick={() => setPreviewTrip(trip)}
                              className="flex-1 py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-700" />
                              <TranslatedText text="Preview" />
                            </button>

                            {/* Open Itinerary Button */}
                            {onSelectTrip && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectTrip(trip.plan);
                                  onClose();
                                }}
                                className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                              >
                                <Compass className="w-3.5 h-3.5" />
                                <TranslatedText text="Open" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Shared Spots */}
              {activeTab === "spots" && (
                <div>
                  {publicSpots.length === 0 ? (
                    <div className="text-center py-10 px-4 bg-white rounded-2xl border border-dashed border-stone-200">
                      <Sparkles className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      <p className="text-stone-600 font-medium text-sm">
                        <TranslatedText text="No individual spots shared yet." />
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {publicSpots.map((spot) => {
                        const actSpot = communitySpotToActivitySpot(spot);
                        return (
                          <div
                            key={spot.id}
                            className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-medium text-[11px] rounded-md uppercase tracking-wider">
                                  {spot.category}
                                </span>
                                <div className="flex items-center gap-1 text-amber-500 text-xs font-semibold">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  <span>{spot.rating?.toFixed(1) || "5.0"}</span>
                                </div>
                              </div>
                              <h4 className="font-bold text-stone-900 text-sm mb-1">{spot.name}</h4>
                              <p className="text-xs text-stone-600 line-clamp-2 mb-2">{spot.description}</p>
                              {spot.insiderTip && (
                                <div className="p-2 bg-amber-50/70 border border-amber-200/60 rounded-lg text-[11px] text-amber-900 mb-2">
                                  <span className="font-semibold">💡 <TranslatedText text="Insider Tip:" /> </span>
                                  {spot.insiderTip}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                              {/* Details & Guide */}
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedSpotForGuide({
                                    spot: actSpot,
                                    destination: spot.cityOrRegion,
                                  })
                                }
                                className="flex-1 py-1.5 px-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                <TranslatedText text="Details" />
                              </button>

                              {onImportSpot && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onImportSpot(spot);
                                    onClose();
                                  }}
                                  className="flex-1 py-1.5 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-2xs"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <TranslatedText text="Import" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Reviews Given */}
              {activeTab === "reviews" && (
                <div className="space-y-3">
                  {userReviews.length === 0 ? (
                    <div className="text-center py-10 px-4 bg-white rounded-2xl border border-dashed border-stone-200">
                      <MessageSquare className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      <p className="text-stone-600 font-medium text-sm">
                        <TranslatedText text="No reviews written for other itineraries yet." />
                      </p>
                    </div>
                  ) : (
                    userReviews.map((rev, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-stone-900 text-sm flex items-center gap-1.5">
                            <Compass className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{rev.tripTitle}</span>
                            <span className="text-stone-400 font-normal text-xs">({rev.destination})</span>
                          </div>
                          <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{rev.rating} / 5</span>
                          </div>
                        </div>
                        <p className="text-xs text-stone-700 leading-relaxed bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                          "{rev.text}"
                        </p>
                        <div className="text-[11px] text-stone-400 text-right">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sub-modal: Itinerary Preview */}
      {previewTrip && (
        <ItineraryPreviewModal
          isOpen={Boolean(previewTrip)}
          onClose={() => setPreviewTrip(null)}
          trip={previewTrip}
          onOpenInWorkspace={(plan) => {
            if (onSelectTrip) onSelectTrip(plan);
            setPreviewTrip(null);
            onClose();
          }}
          onSaveCopy={(plan) => {
            saveTrip(plan);
            if (onShowToast) onShowToast(`Saved copy of "${plan.title}" to My Trips!`, "success");
          }}
          onOpenActivityDetails={(spot, dayNum) => {
            setSelectedSpotForGuide({
              spot,
              destination: previewTrip.plan.destinationOrTown,
              dayNumber: dayNum,
            });
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* Sub-modal: Activity Details */}
      {selectedSpotForGuide && (
        <ActivityDetailModal
          spot={selectedSpotForGuide.spot}
          destination={selectedSpotForGuide.destination}
          dayNumber={selectedSpotForGuide.dayNumber}
          onClose={() => setSelectedSpotForGuide(null)}
        />
      )}
    </div>
  );
};
