package com.syntax.class06;

public class LogicalNot {
	public static void main(String[] args) {
		
		//not(!)-reverse the condition
		boolean b=!true;
		boolean val=!false;
		System.out.println(b);
        System.out.println(val);
        boolean cold=!true;
        if(!cold) {
        	System.out.println("hello");
        }else {
        	System.out.println("bye");
        }
        String day1="monday";
        
        //if it s not monday or friday---I will be at synatx
        
        if(!day1.equals("monday")&&!day1.equals("friday")){
        System.out.println("find me at syntax");
        
        }
        if(!(day1.equals("monday")&&day1.equals("friday"))){
        	
        	System.out.println("find me at syntax");
        }
        }
	

}