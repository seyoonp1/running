"""
Loop detection algorithm
MVP 버전: Room.current_hex_ownerships JSONField 사용
"""
from .h3_utils import get_h3_neighbors
import h3


class LoopDetector:
    """Detects loops in hex ownership graph"""
    
    def __init__(self, room_id: str):
        self.room_id = room_id
    
    def detect_loop(self, team: str, current_hex_ownerships: dict, new_hex_id: str = None) -> dict:
        """
        Detect loops in team's owned hexes
        
        Args:
            team: Team string ('A' or 'B')
            current_hex_ownerships: Room.current_hex_ownerships JSONField
            new_hex_id: 새로 점령한 hex ID (이 hex가 포함된 루프만 찾음, None이면 모든 루프 검사)
        
        Returns:
            Dict with 'loop_h3_ids' and 'interior_h3_ids', or None
        """
        # Get all owned hexes for this team from JSONField
        hex_set = set(
            h3_id for h3_id, ownership in current_hex_ownerships.items()
            if ownership.get('team') == team
        )
        
        if len(hex_set) < 3:  # Minimum 3 hexes for a loop
            return None
        
        # 새로 점령한 hex가 팀 소유가 아니면 None 반환
        if new_hex_id and new_hex_id not in hex_set:
            return None
        
        # Build graph
        graph = self._build_hex_graph(hex_set)
        
        # Find cycles
        if new_hex_id:
            # 새로 점령한 hex를 시작점으로 하는 루프만 찾기
            cycles = self._find_cycles_from_node(graph, hex_set, new_hex_id)
        else:
            # 기존 방식: 모든 루프 찾기
            cycles = self._find_cycles(graph, hex_set)
        
        if not cycles:
            return None
        
        # 새로 점령한 hex가 포함된 루프만 선택
        if new_hex_id:
            cycles_with_new_hex = [c for c in cycles if new_hex_id in c]
            if cycles_with_new_hex:
                # 새로 점령한 hex가 포함된 루프 중 가장 작은 것 선택 (가장 최근에 완성된 루프)
                selected_cycle = min(cycles_with_new_hex, key=len)
            else:
                return None
        else:
            # 기존 방식: 가장 큰 루프 선택
            selected_cycle = max(cycles, key=len)
        
        # Find interior hexes
        interior = self._find_interior_hexes(selected_cycle, hex_set)
        
        return {
            'loop_h3_ids': selected_cycle,
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
        """Find cycles using DFS (모든 노드에서 시작)"""
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
    
    def _find_cycles_from_node(self, graph: dict, hex_set: set, start_node: str) -> list:
        """특정 노드에서 시작하는 사이클만 찾기"""
        visited = set()
        cycles = []
        
        def dfs(node, path):
            if node in path:
                # Found a cycle
                cycle_start = path.index(node)
                cycle = path[cycle_start:] + [node]
                # 시작 노드가 포함된 사이클만 추가
                if len(cycle) >= 4 and start_node in cycle:
                    cycles.append(cycle[:-1])  # Remove duplicate closing node
                return
            
            if node in visited:
                return
            
            visited.add(node)
            for neighbor in graph.get(node, []):
                if neighbor not in path or neighbor == path[-2] if len(path) > 1 else False:
                    dfs(neighbor, path + [neighbor])
            visited.remove(node)
        
        # 시작 노드에서만 DFS 시작
        if start_node in hex_set:
            dfs(start_node, [start_node])
        
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

