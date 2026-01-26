"""
Sessions models - DEPRECATED
Session 개념이 Room에 병합되었습니다.
이 파일은 마이그레이션 호환성을 위해 유지됩니다.
"""

# 모든 모델이 rooms 앱으로 이동됨
# - Session → Room (병합)
# - Team → Participant.team (A/B 문자열로 단순화)
# - Participant → rooms.Participant
# - HexOwnership → Room.current_hex_ownerships (JSONField)
# - EventLog, PlayerStats, ChatMessage → 제거 (MVP에서 불필요)
