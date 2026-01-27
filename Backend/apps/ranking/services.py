from django.db import transaction
from django.utils import timezone

from apps.rooms.models import Participant


class RankingService:
    K_FACTOR = 32
    MVP_BONUS = 15

    def calculate_rating_change(self, player_rating, opponent_avg_rating, result):
        expected = 1 / (1 + 10 ** ((opponent_avg_rating - player_rating) / 400))
        return int(round(self.K_FACTOR * (result - expected)))

    def compute_hex_counts(self, room):
        ownerships = room.current_hex_ownerships or {}
        counts = {}
        for hex_data in ownerships.values():
            user_id = hex_data.get('user_id')
            if user_id:
                key = str(user_id)
                counts[key] = counts.get(key, 0) + 1
        return counts

    def compute_team_avg_ratings(self, participants):
        team_ratings = {'A': [], 'B': []}
        for participant in participants:
            team_ratings[participant.team].append(participant.user.rating)

        averages = {}
        for team, ratings in team_ratings.items():
            averages[team] = sum(ratings) / len(ratings) if ratings else 0
        return averages

    def pick_mvp(self, participants, hex_counts):
        top_participants = []
        max_count = 0
        for participant in participants:
            count = hex_counts.get(str(participant.user_id), 0)
            if count > max_count:
                max_count = count
                top_participants = [participant]
            elif count == max_count and max_count > 0:
                top_participants.append(participant)

        if max_count == 0 or len(top_participants) != 1:
            return None
        return top_participants[0]

    def process_game_end(self, room):
        with transaction.atomic():
            room.refresh_from_db()
            if room.status == 'finished':
                return None

            participants = list(
                Participant.objects.select_related('user').filter(room=room)
            )
            if not participants:
                room.status = 'finished'
                room.save(update_fields=['status'])
                return None

            winner_team = room.determine_winner()
            hex_counts = self.compute_hex_counts(room)
            team_avg_ratings = self.compute_team_avg_ratings(participants)
            mvp_participant = self.pick_mvp(participants, hex_counts)

            for participant in participants:
                user = participant.user
                if winner_team is None:
                    result = 0.5
                else:
                    result = 1 if participant.team == winner_team else 0

                opponent_team = 'B' if participant.team == 'A' else 'A'
                opponent_avg_rating = team_avg_ratings.get(opponent_team) or user.rating

                rating_change = self.calculate_rating_change(
                    user.rating,
                    opponent_avg_rating,
                    result,
                )
                bonus = self.MVP_BONUS if mvp_participant and participant.id == mvp_participant.id else 0
                total_change = rating_change + bonus

                participant.rating_change = total_change
                participant.hexes_claimed = hex_counts.get(str(user.id), 0)
                participant.is_mvp = bool(bonus)
                participant.save(update_fields=['rating_change', 'hexes_claimed', 'is_mvp'])

                user.rating = user.rating + total_change
                user.games_played += 1
                if winner_team is None:
                    user.games_draw += 1
                elif participant.team == winner_team:
                    user.games_won += 1
                else:
                    user.games_lost += 1
                if bonus:
                    user.mvp_count += 1
                if user.rating > user.highest_rating:
                    user.highest_rating = user.rating
                user.save(update_fields=[
                    'rating',
                    'games_played',
                    'games_won',
                    'games_lost',
                    'games_draw',
                    'mvp_count',
                    'highest_rating',
                ])

            room.mvp = mvp_participant.user if mvp_participant else None
            room.status = 'finished'
            room.updated_at = timezone.now()
            room.save(update_fields=['mvp', 'status', 'updated_at'])

            return {
                'winner_team': winner_team,
                'mvp_user': mvp_participant.user if mvp_participant else None,
                'team_a_count': room.get_team_hex_count('A'),
                'team_b_count': room.get_team_hex_count('B'),
            }
