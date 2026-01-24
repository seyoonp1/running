"""
Loop detection algorithm
"""
from apps.sessions.models import HexOwnership
from .h3_utils import get_h3_neighbors
import h3


class LoopDetector:
    """Detects loops in hex ownership graph"""
    
    def __init__(self, session_id: str):
        self.session_id = session_id
    
    def detect_loop(self, team_id: str) -> dict:
        """
        Detect loops in team's owned hexes
        
        Args:
            team_id: Team UUID string
        
        Returns:
            Dict with 'loop_h3_ids' and 'interior_h3_ids', or None
        """
        # Get all owned hexes for this team
        hex_ownerships = HexOwnership.objects.filter(
            session_id=self.session_id,
            team_id=team_id
        ).values_list('h3_id', flat=True)
        
        hex_set = set(hex_ownerships)
        if len(hex_set) < 3:  # Minimum 3 hexes for a loop
            return None
        
        # Build graph
        graph = self._build_hex_graph(hex_set)
        
        # Find cycles
        cycles = self._find_cycles(graph, hex_set)
        
        if not cycles:
            return None
        
        # Get largest cycle
        largest_cycle = max(cycles, key=len)
        
        # Find interior hexes
        interior = self._find_interior_hexes(largest_cycle, hex_set)
        
        return {
            'loop_h3_ids': largest_cycle,
            'interior_h3_ids': interior
        }
    
    def _build_hex_graph(self, hex_set: set) -> dict:
        """Build adjacency graph"""
        graph = {}
        for h3_id in hex_set:
            neighbors = get_h3_neighbors(h3_id, k=1)
            graph[h3_id] = [n for n in neighbors if n in hex_set]
        return graph
    
    def _find_cycles(self, graph: dict, hex_set: set) -> list:
        """Find cycles using DFS"""
        visited = set()
        cycles = []
        
        def dfs(node, path):
            if node in path:
                # Found a cycle
                cycle_start = path.index(node)
                cycle = path[cycle_start:] + [node]
                if len(cycle) >= 4:  # Minimum 3 unique nodes + closing node
                    cycles.append(cycle[:-1])  # Remove duplicate closing node
                return
            
            if node in visited:
                return
            
            visited.add(node)
            for neighbor in graph.get(node, []):
                if neighbor not in path or neighbor == path[-2] if len(path) > 1 else False:
                    dfs(neighbor, path + [neighbor])
            visited.remove(node)
        
        for h3_id in hex_set:
            if h3_id not in visited:
                dfs(h3_id, [h3_id])
        
        return cycles
    
    def _find_interior_hexes(self, loop_h3_ids: list, all_owned: set) -> list:
        """
        Find hexes inside the loop using polygon fill
        
        This is a simplified version. For production, use H3 polygon fill API.
        """
        interior = []
        
        # Get bounding box of loop
        lats = []
        lngs = []
        for h3_id in loop_h3_ids:
            lat, lng = h3.h3_to_geo(h3_id)
            lats.append(lat)
            lngs.append(lng)
        
        min_lat, max_lat = min(lats), max(lats)
        min_lng, max_lng = min(lngs), max(lngs)
        
        # Simple grid search (can be optimized)
        # For MVP, we'll use a k-ring expansion approach
        # Get all hexes in a larger ring around the loop
        expanded_set = set(loop_h3_ids)
        for h3_id in loop_h3_ids:
            expanded_set.update(get_h3_neighbors(h3_id, k=3))
        
        # Filter hexes that are inside the loop polygon
        # This is simplified - in production use proper polygon point-in-polygon test
        for candidate in expanded_set:
            if candidate not in all_owned and candidate not in loop_h3_ids:
                # Check if candidate is inside polygon (simplified)
                lat, lng = h3.h3_to_geo(candidate)
                if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
                    # Additional check: candidate should be surrounded by loop hexes
                    neighbors = get_h3_neighbors(candidate, k=1)
                    neighbor_count = sum(1 for n in neighbors if n in loop_h3_ids)
                    if neighbor_count >= 3:  # At least 3 neighbors are in loop
                        interior.append(candidate)
        
        return interior

