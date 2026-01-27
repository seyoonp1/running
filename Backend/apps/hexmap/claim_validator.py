"""
Hex claim validation logic
"""
import logging
from datetime import datetime, timedelta
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


class ClaimValidator:
    """Validates hex claims based on GPS samples"""
    
    def __init__(self, participant_id: str):
        self.participant_id = participant_id
        self.cache_key = f'claim_samples_{participant_id}'
        self.min_samples = settings.H3_CLAIM_MIN_SAMPLES
        self.min_dwell_sec = settings.H3_CLAIM_MIN_DWELL_SEC
    
    def add_location_sample(self, lat: float, lng: float, h3_id: str, timestamp: datetime):
        """Add a location sample"""
        samples = self.get_samples()
        samples.append({
            'h3_id': h3_id,
            'timestamp': timestamp.isoformat(),
            'lat': lat,
            'lng': lng
        })
        
        # Keep only recent samples (last N+1)
        if len(samples) > self.min_samples + 1:
            samples.pop(0)
        
        self.save_samples(samples)
    
    def check_claim(self) -> str:
        """
        Check if claim is valid based on recent samples
        
        Returns:
            H3 ID if claim is valid, None otherwise
        """
        samples = self.get_samples()
        
        if len(samples) < self.min_samples:
            logger.debug(
                "Claim check: insufficient samples. participant=%s samples=%d required=%d",
                self.participant_id,
                len(samples),
                self.min_samples,
            )
            return None
        
        # Check last N samples
        recent_samples = samples[-self.min_samples:]
        recent_h3_ids = [s['h3_id'] for s in recent_samples]
        unique_hexes = set(recent_h3_ids)
        
        # All samples must be in the same hex
        if len(unique_hexes) != 1:
            logger.debug(
                "Claim check: samples in different hexes. participant=%s hexes=%s",
                self.participant_id,
                list(unique_hexes),
            )
            return None
        
        # Check dwell time
        first_timestamp = datetime.fromisoformat(recent_samples[0]['timestamp'])
        last_timestamp = datetime.fromisoformat(recent_samples[-1]['timestamp'])
        time_span = (last_timestamp - first_timestamp).total_seconds()
        
        if time_span < self.min_dwell_sec:
            logger.debug(
                "Claim check: insufficient dwell time. participant=%s h3_id=%s time_span=%.2f required=%.2f",
                self.participant_id,
                recent_h3_ids[0],
                time_span,
                self.min_dwell_sec,
            )
            return None
        
        # Claim is valid
        logger.info(
            "Claim check: VALID. participant=%s h3_id=%s samples=%d time_span=%.2f",
            self.participant_id,
            recent_h3_ids[0],
            len(recent_samples),
            time_span,
        )
        return recent_h3_ids[0]
    
    def get_samples(self) -> list:
        """Get cached samples"""
        return cache.get(self.cache_key, [])
    
    def save_samples(self, samples: list):
        """Save samples to cache"""
        cache.set(self.cache_key, samples, timeout=300)  # 5 minutes
    
    def clear_samples(self):
        """Clear cached samples"""
        cache.delete(self.cache_key)

