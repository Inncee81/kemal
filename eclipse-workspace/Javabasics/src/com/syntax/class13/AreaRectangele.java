package com.syntax.class13;
class Arearec{
	int length;
	int width;
	int area;
	
	int input(int l,int w){
		width=w;
		length=l;
		area=w*l;
		return area;
	}
	void display() {
		System.out.println("I am a recttangle width "+width+" and length "+"and area is "+area);
	}
	
	
}







public class AreaRectangele {

	public static void main(String[] args) {
		Arearec a1=new Arearec();
		Arearec a2=new Arearec();
		System.out.println(a2.input(12, 5));
		System.out.println(a1.input(30, 40));
		a1.display();
		a2.display();
	}

}
