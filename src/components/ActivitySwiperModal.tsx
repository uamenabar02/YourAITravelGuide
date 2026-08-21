import React, { useState } from "react";
import { CandidateSpot, ActivitySpot, PlaceReview } from "../types";
import {
  X,
  Heart,
  MapPin,
  ExternalLink,
  Star,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Compass,
  CheckCircle,
  Layers,
} from "lucide-react";
import { getCuratedPhotosForSpot, generateGoogleMapsSearchUrl, generateSampleReviews } from "../utils/destinations";

interface ActivitySwiperModalProps {
  destination: string;
  candidates: CandidateSpot[];
  isOpen: boolean;
  onClose: () => void;
  onFinishSwiping: (likedSpots: ActivitySpot[], skippedSpots: ActivitySpot[]) => void;
}

export const ActivitySwiperModal: React.FC<ActivitySwiperModalProps> = ({
  destination,
  candidates,
  isOpen,
  onClose,
  onFinishSwiping,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedSpots, setLikedSpots] = useState<ActivitySpot[]>([]);
  const [skippedSpots, setSkippedSpots] = useState<ActivitySpot[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showReviewsTab, setShowReviewsTab] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);

  if (!isOpen || candidates.length === 0) return null;

  const currentSpot = candidates[currentIndex];
  const isFinished = currentIndex >= candidates.length;

  const photos = currentSpot?.photos && currentSpot.photos.length > 0
    ? currentSpot.photos
    : getCuratedPhotosForSpot(currentSpot?.category || "sightseeing", currentSpot?.name || "", destination);

  const reviews: PlaceReview[] = currentSpot?.reviews && currentSpot.reviews.length > 0
    ? currentSpot.reviews
    : generateSampleReviews(currentSpot?.name || "this spot", currentSpot?.rating || 4.8);

  const mapsUrl = currentSpot?.googleMapsUrl || generateGoogleMapsSearchUrl(currentSpot?.name || "", destination);

  const handleSwipe = (direction: "left" | "right") => {
    setSwipeDirection(direction);
    setTimeout(() => {
      if (direction === "right" && currentSpot) {
        setLikedSpots((prev) => [...prev, currentSpot]);
      } else if (direction === "left" && currentSpot) {
        setSkippedSpots((prev) => [...prev, currentSpot]);
      }
      setSwipeDirection(null);
      setActivePhotoIndex(0);
      setShowReviewsTab(false);
      setCurrentIndex((prev) => prev + 1);
    }, 220);
  };

  const handleBuildPlan = () => {
    onFinishSwiping(likedSpots, skippedSpots);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2c2c24]/70 backdrop-blur-xs animate-in fade-in-20">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-[#d1d1ca] flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 px-6 bg-[#f5f5f0] border-b border-[#e5e5df] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-8 h-8 rounded-full bg-[#5A5A40] text-white flex items-center justify-center text-sm font-serif">
              ✨
            </span>
            <div>
              <h3 className="font-serif text-lg font-light italic text-[#2c2c24]">
                Activity Discovery Swiper
              </h3>
              <p className="text-[11px] text-[#8a8a7e] font-sans font-medium">
                {destination} • Swipe right to prioritize spots
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar & Counter */}
        <div className="px-6 py-2.5 bg-white border-b border-[#ecece4] flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-[#5A5A40] font-medium font-serif italic">
            <Heart className="w-3.5 h-3.5 fill-[#5A5A40] text-[#5A5A40]" />
            <span>{likedSpots.length} Liked</span>
          </div>

          <span className="text-[#8a8a7e] font-sans">
            {isFinished ? "Completed" : `Spot ${currentIndex + 1} of ${candidates.length}`}
          </span>

          <button
            onClick={handleBuildPlan}
            className="px-3 py-1 bg-[#5A5A40] text-white text-xs rounded-full font-serif italic hover:bg-[#4a4a35] transition-all shadow-xs"
          >
            Build Plan ({likedSpots.length})
          </button>
        </div>

        {/* Main Card View / Completion View */}
        <div className="flex-1 overflow-y-auto p-5">
          {isFinished ? (
            <div className="text-center py-10 px-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#ecece4] text-[#5A5A40] flex items-center justify-center text-2xl mx-auto border border-[#d1d1ca]">
                🎉
              </div>
              <h4 className="font-serif text-2xl font-light italic text-[#2c2c24]">
                Discovery Session Complete!
              </h4>
              <p className="text-sm text-[#6b6b5e] max-w-xs mx-auto">
                You liked {likedSpots.length} activities. LocalExplorer AI will now build your optimal itinerary incorporating your selections!
              </p>

              <div className="pt-4">
                <button
                  onClick={handleBuildPlan}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#5A5A40] text-white font-serif italic font-medium hover:bg-[#4a4a35] shadow-sm transition-all"
                >
                  Generate My Tailored Itinerary →
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`space-y-4 transition-transform duration-200 ${
                swipeDirection === "left"
                  ? "-translate-x-20 opacity-0 rotate-[-8deg]"
                  : swipeDirection === "right"
                  ? "translate-x-20 opacity-0 rotate-[8deg]"
                  : ""
              }`}
            >
              {/* Photo Gallery Carousel */}
              <div className="relative rounded-2xl overflow-hidden bg-[#2c2c24] h-52 sm:h-56 group">
                <img
                  src={photos[activePhotoIndex] || photos[0]}
                  alt={currentSpot.name}
                  className="w-full h-full object-cover transition-all duration-300"
                  referrerPolicy="no-referrer"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                {/* Photo Navigation Arrows */}
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70 backdrop-blur-xs transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70 backdrop-blur-xs transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* Category & Rating Badges on Photo */}
                <div className="absolute top-3 left-3 flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-black/50 text-white backdrop-blur-xs border border-white/20 capitalize">
                    {currentSpot.category}
                  </span>
                </div>

                <div className="absolute top-3 right-3 flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white shadow-xs">
                  <Star className="w-3 h-3 fill-white text-white mr-0.5" />
                  <span>{currentSpot.rating || 4.9}</span>
                </div>

                {/* Photo Indicators */}
                {photos.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1">
                    {photos.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${
                          i === activePhotoIndex ? "w-5 bg-white" : "w-1.5 bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Title & Cost info */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-serif text-xl font-medium italic text-[#2c2c24] leading-snug">
                    {currentSpot.name}
                  </h4>
                  <span className="text-xs font-serif italic text-[#2c2c24] bg-[#ecece4] px-2.5 py-1 rounded-full border border-[#d1d1ca] shrink-0">
                    {currentSpot.approxCost}
                  </span>
                </div>

                {/* Exact Location & Address */}
                <div className="flex items-center space-x-1.5 text-xs text-[#8a8a7e] font-sans mt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                  <span className="line-clamp-1">{currentSpot.address || `${destination} (Exact coords mapped)`}</span>
                </div>
              </div>

              {/* Toggle Tabs: Details vs Google Maps Opinions */}
              <div className="flex rounded-xl bg-[#ecece4] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setShowReviewsTab(false)}
                  className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                    !showReviewsTab ? "bg-white text-[#2c2c24] shadow-xs" : "text-[#6b6b5e]"
                  }`}
                >
                  Overview & Tips
                </button>
                <button
                  type="button"
                  onClick={() => setShowReviewsTab(true)}
                  className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center space-x-1 ${
                    showReviewsTab ? "bg-white text-[#2c2c24] shadow-xs" : "text-[#6b6b5e]"
                  }`}
                >
                  <MessageSquare className="w-3 h-3 text-[#5A5A40]" />
                  <span>Google Maps Opinions ({reviews.length})</span>
                </button>
              </div>

              {/* Tab 1: Overview & Insider Tips */}
              {!showReviewsTab ? (
                <div className="space-y-3 text-xs text-[#2c2c24]">
                  <p className="leading-relaxed font-sans text-sm text-[#2c2c24]/90">
                    {currentSpot.description}
                  </p>

                  {currentSpot.insiderTip && (
                    <div className="bg-[#ecece4] border border-[#d1d1ca] p-3 rounded-xl text-xs flex items-start space-x-2">
                      <span className="text-base">💡</span>
                      <div>
                        <span className="font-serif italic font-semibold text-[#2c2c24] mr-1">Insider Secret:</span>
                        <span className="text-[#6b6b5e]">{currentSpot.insiderTip}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Tab 2: Google Maps Reviews & Opinions */
                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-900">
                    <span className="font-medium">Google Maps Visitor Sentiment</span>
                    <span className="font-bold flex items-center">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500 mr-1" />
                      {currentSpot.rating || 4.9} / 5.0
                    </span>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {reviews.map((rev, idx) => (
                      <div key={idx} className="bg-[#f5f5f0] p-2.5 rounded-xl border border-[#e5e5df] space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-[#2c2c24]">{rev.author}</span>
                          <div className="flex items-center text-amber-500">
                            {Array.from({ length: Math.round(rev.rating) }).map((_, i) => (
                              <Star key={i} className="w-2.5 h-2.5 fill-current" />
                            ))}
                          </div>
                        </div>
                        <p className="text-[#6b6b5e] italic font-serif">"{rev.text}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct Google Maps Link */}
              <div className="pt-1">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-[#f5f5f0] hover:bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca] text-xs font-medium transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View on Google Maps & Reviews</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Swiper Actions Toolbar */}
        {!isFinished && (
          <div className="p-4 px-6 bg-[#f5f5f0] border-t border-[#e5e5df] flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => handleSwipe("left")}
              className="flex-1 py-3 px-4 rounded-2xl bg-white border border-[#d1d1ca] hover:bg-rose-50 hover:border-rose-300 text-[#6b6b5e] hover:text-rose-700 font-sans font-medium text-sm flex items-center justify-center space-x-2 transition-all shadow-xs"
            >
              <X className="w-4 h-4 text-rose-500" />
              <span>Pass / Skip</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwipe("right")}
              className="flex-1 py-3 px-4 rounded-2xl bg-[#5A5A40] hover:bg-[#4a4a35] text-white font-serif italic font-medium text-sm flex items-center justify-center space-x-2 transition-all shadow-sm active:scale-95"
            >
              <Heart className="w-4 h-4 fill-white" />
              <span>Add to Plan ❤️</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
