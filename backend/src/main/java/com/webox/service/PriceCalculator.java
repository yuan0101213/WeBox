package com.webox.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.webox.common.ApiException;
import java.util.*;

public final class PriceCalculator {
    public record Price(long unitPriceFen, ArrayNode options) {}
    public static Price calculate(long base, JsonNode groups, JsonNode selected) {
        Map<String,JsonNode> valid = new HashMap<>();
        for (JsonNode group:groups) for(JsonNode option:group.path("options"))
            valid.put(group.path("id").asText()+":"+option.path("id").asText(),option);
        Set<String> seen = new HashSet<>();
        Map<String,Integer> counts = new HashMap<>();
        ArrayNode snapshots=JsonNodeFactory.instance.arrayNode();
        long price=base;
        for (JsonNode selection:selected) {
            String groupId=selection.path("groupId").asText(), optionId=selection.path("optionId").asText();
            String key=groupId+":"+optionId;
            JsonNode option=valid.get(key);
            if(option==null || !seen.add(key)) throw ApiException.bad("Invalid or duplicate customization option.");
            counts.merge(groupId,1,Integer::sum);
            price=Math.addExact(price,option.path("extraPriceFen").asLong());
            var snapshot=snapshots.addObject();
            snapshot.put("groupId",groupId).put("optionId",optionId).put("name",option.path("name").asText()).put("extraPriceFen",option.path("extraPriceFen").asLong());
            for(JsonNode group:groups) if(group.path("id").asText().equals(groupId)) snapshot.put("groupName",group.path("name").asText());
        }
        for(JsonNode group:groups) {
            int count=counts.getOrDefault(group.path("id").asText(),0);
            if(count<group.path("minSelect").asInt() || count>group.path("maxSelect").asInt())
                throw ApiException.bad("Please check the selections for "+group.path("name").asText()+".");
        }
        return new Price(price,snapshots);
    }
}
